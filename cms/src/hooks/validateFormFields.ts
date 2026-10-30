import type { CollectionBeforeValidateHook } from 'payload'

import { APIError } from 'payload'

import { isAllowedLinkUrl } from '../lexical/editor'

// `fax` is the honeypot input on every rendered form, and `_rendered_at` is the
// client timestamp. A form field with either name would collide in the posted
// FormData, and spamGuard would read visitor input as spam signals.
const RESERVED_FIELD_NAMES = ['fax', '_rendered_at']

// Runs when an editor saves a form, so a bad field name fails there instead of
// rejecting every submission later. validateSubmission relies on unique names:
// it treats a duplicate field name in a submission as forged.
export const validateFormFields: CollectionBeforeValidateHook = ({ data }) => {
  const redirect = (data?.redirect as { url?: unknown } | undefined)?.url
  if (redirect != null && typeof redirect !== 'string') {
    throw new APIError('The redirect must be a text value.', 400, undefined, true)
  }
  if (typeof redirect === 'string' && redirect !== '' && !isAllowedLinkUrl(redirect)) {
    throw new APIError(
      `The redirect "${redirect}" is not a path or an http(s), mailto: or tel: address.`,
      400,
      undefined,
      true,
    )
  }
  const fields: unknown = data?.fields ?? []
  if (!Array.isArray(fields)) {
    throw new APIError('The form fields must be a list.', 400, undefined, true)
  }
  const seen = new Set<string>()
  for (const field of fields as { name?: unknown }[]) {
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
