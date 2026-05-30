import type { CollectionBeforeChangeHook } from 'payload'

import { APIError } from 'payload'

const MIN_ELAPSED_MS = 1_500

type SubmissionEntry = { field: string; value: string }

const isEntry = (value: unknown): value is SubmissionEntry => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as { field?: unknown; value?: unknown }
  return typeof entry.field === 'string' && typeof entry.value === 'string'
}

export const spamGuard: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const raw = (data as { submissionData?: unknown }).submissionData
  if (!Array.isArray(raw)) {
    req.payload.logger.info('form submission rejected: missing submissionData')
    throw new APIError('Submission rejected.', 400, undefined, true)
  }

  const entries = raw.filter(isEntry)
  const honeypot = entries.find((entry) => entry.field === 'fax')
  const stamp = entries.find((entry) => entry.field === '_rendered_at')

  if (honeypot?.value.trim()) {
    req.payload.logger.info('form submission rejected: honeypot filled')
    throw new APIError('Submission rejected.', 400, undefined, true)
  }

  const stampValue = stamp ? Number.parseInt(stamp.value, 10) : NaN
  if (!Number.isFinite(stampValue)) {
    req.payload.logger.info('form submission rejected: missing render stamp')
    throw new APIError('Submission rejected.', 400, undefined, true)
  }
  const elapsed = Date.now() - stampValue
  if (elapsed < MIN_ELAPSED_MS) {
    req.payload.logger.info({ elapsed }, 'form submission rejected: submitted too fast')
    throw new APIError('Submission rejected.', 400, undefined, true)
  }

  return {
    ...data,
    submissionData: entries.filter(
      (entry) => entry.field !== 'fax' && entry.field !== '_rendered_at',
    ),
  }
}
