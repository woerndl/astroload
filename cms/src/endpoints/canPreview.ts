import type { PayloadRequest } from 'payload'

// A preview request reads drafts, so only callers allowed to see drafts may make
// one: panel users and the preview API key. A read-only key requesting preview
// is rejected, so it does not reach draft content through these endpoints.
export function canPreview(req: PayloadRequest): boolean {
  const { user } = req
  if (!user) return false
  if (user.collection === 'users') return true
  return user.collection === 'api-keys' && user.type === 'preview'
}
