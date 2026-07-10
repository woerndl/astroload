import type { CollectionBeforeChangeHook } from 'payload'

import { APIError, NotFound } from 'payload'

const reject = () => new APIError('Submission rejected.', 400, undefined, true)

// A required checkbox (consent) must be ticked. A checked box posts 'on' (the
// browser default for a valueless checkbox) or 'true'. An unticked one is
// omitted entirely. Every other required field just needs a non-empty value.
const hasValue = (blockType: string, value: string | undefined): boolean => {
  if (value == null) return false
  if (blockType === 'checkbox') return value === 'true' || value === 'on'
  return value.trim().length > 0
}

// Reject a submission that omits a required field of its referenced form. The
// public POST endpoint accepts any payload, so without this a forged or
// malformed request bypasses the form's own required marks. Runs after
// spamGuard, which has already normalized submissionData. Presence is the only
// check: value shapes (an email field holding a non-email, a select value
// outside its options) are not validated, because submissions land in a review
// queue rather than driving automation.
export const validateSubmission: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data

  const formId = (data as { form?: unknown }).form
  if (typeof formId !== 'string' && typeof formId !== 'number') {
    throw reject()
  }

  // findByID throws NotFound for a forged or stale form id. Collapse that into
  // the same generic rejection so the response never distinguishes the cases.
  // A transient lookup error keeps its own status instead of reading as rejected.
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
    // Field names are unique per form (the Forms collection validates that on
    // save), so a real submission posts each name once and a duplicate here is
    // malformed or forged. This assumes single-valued fields (no multi-select
    // in this starter). Collect values per name if a multi-value field is added.
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
