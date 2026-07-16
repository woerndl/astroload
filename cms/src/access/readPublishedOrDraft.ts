import type { Access, AccessArgs } from 'payload'

// Read-only API keys are the public site identity and do not receive drafts.
// Use only on collections with versions + drafts. The _status filter has no
// effect on collections without a draft state.
export const readPublishedOrDraft: Access = ({ req: { user } }: AccessArgs) => {
  if (!user) return false

  // Every API key except the preview key is filtered to published content.
  // A later key type therefore does not receive drafts by omission.
  if (user.collection === 'api-keys' && user.type !== 'preview') {
    return { _status: { equals: 'published' } }
  }

  return true
}
