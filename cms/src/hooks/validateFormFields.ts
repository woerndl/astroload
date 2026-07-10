import type { CollectionBeforeValidateHook } from 'payload'

import { APIError } from 'payload'

// Field names the submission pipeline claims for itself: `fax` is the
// honeypot input every rendered form carries, `_rendered_at` is the client
// time stamp. A form field with either name would collide in the posted
// FormData, and spamGuard would then read visitor input as spam signals.
const RESERVED_FIELD_NAMES = ['fax', '_rendered_at']

// Authoring-time guard on the Forms collection, so an editor gets a clear
// message on save instead of a form whose submissions all reject in
// production. validateSubmission relies on the uniqueness rule: it treats a
// duplicate field name in a submission as forged.
export const validateFormFields: CollectionBeforeValidateHook = ({ data }) => {
  const fields = (data?.fields ?? []) as { name?: unknown }[]
  const seen = new Set<string>()
  for (const field of fields) {
    if (typeof field.name !== 'string') continue
    if (RESERVED_FIELD_NAMES.includes(field.name)) {
      throw new APIError(
        `The field name "${field.name}" is reserved for the spam guard. Pick another name.`,
        400,
        undefined,
        true,
      )
    }
    if (seen.has(field.name)) {
      throw new APIError(
        `The field name "${field.name}" is used more than once. Field names must be unique within a form.`,
        400,
        undefined,
        true,
      )
    }
    seen.add(field.name)
  }
  return data
}
