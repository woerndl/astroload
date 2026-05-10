import type { Access, AccessArgs } from 'payload'

// Read-only API keys are the public site identity and must never see drafts.
// Use only on collections with versions + drafts. The _status filter has no
// effect on collections without a draft state.
export const readPublishedOrDraft: Access = ({ req: { user } }: AccessArgs) => {
  if (!user) return false

  if (user.collection === 'api-keys' && user.type === 'read-only') {
    return { _status: { equals: 'published' } }
  }

  return true
}
