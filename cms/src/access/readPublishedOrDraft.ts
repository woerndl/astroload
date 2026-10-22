import type { Access, AccessArgs } from 'payload'

// Use only on collections with drafts enabled, because the API key filter
// queries the _status field.
export const readPublishedOrDraft: Access = ({ req: { user } }: AccessArgs) => {
  if (!user) return false

  // Every key type except preview is filtered, so a key type added later
  // gets published content only.
  if (user.collection === 'api-keys' && user.type !== 'preview') {
    return { _status: { equals: 'published' } }
  }

  return true
}
