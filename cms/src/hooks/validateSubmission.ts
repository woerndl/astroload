import type { CollectionBeforeChangeHook } from 'payload'

import { APIError, NotFound } from 'payload'

const reject = () => new APIError('Submission rejected.', 400, undefined, true)

// A checked checkbox posts 'on' (the browser default without a value
// attribute) or 'true', and an unchecked one posts nothing. Other required
// fields need a non-empty value.
const hasValue = (blockType: string, value: string | undefined): boolean => {
  if (value == null) return false
  if (blockType === 'checkbox') return value === 'true' || value === 'on'
  return value.trim().length > 0
}

// The public POST endpoint accepts any payload, so this enforces the form's
// required fields on the server. Runs after spamGuard, which normalizes
// submissionData. It checks presence only and skips value formats (an email
// field holding a non-email, a select value outside its options), because a
// person reads submissions in the admin panel.
export const validateSubmission: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data

  const formId = (data as { form?: unknown }).form
  if (typeof formId !== 'string' && typeof formId !== 'number') {
    throw reject()
  }

  // A forged or stale form id gets the same generic rejection as the other
  // checks. Other lookup errors keep their own status.
  const form = await req.payload
    .findByID({ collection: 'forms', id: formId, depth: 0, overrideAccess: true })
    .catch((err) => {
      if (err instanceof NotFound) throw reject()
      throw err
    })

  const entries = ((data as { submissionData?: unknown }).submissionData ?? []) as {
    field?: unknown
    value?: unknown
  }[]
  const valueByField = new Map<string, string | undefined>()
  for (const entry of entries) {
    if (typeof entry.field !== 'string') continue
    // validateFormFields keeps field names unique per form, so a duplicate here
    // is forged or malformed. A multi-value field type would need its values
    // collected per name.
    if (valueByField.has(entry.field)) throw reject()
    valueByField.set(entry.field, typeof entry.value === 'string' ? entry.value : undefined)
  }

  for (const field of form.fields ?? []) {
    if (!('name' in field) || field.required !== true) continue
    if (!hasValue(field.blockType, valueByField.get(field.name))) {
      req.payload.logger.info(
        { field: field.name },
        'form submission rejected: missing required field',
      )
      throw reject()
    }
  }

  return data
}
