import type { PayloadRequest } from 'payload'

// Preview requests read drafts, so only panel users and the preview API key
// may make them.
export function canPreview(req: PayloadRequest): boolean {
  const { user } = req
  if (!user) return false
  if (user.collection === 'users') return true
  return user.collection === 'api-keys' && user.type === 'preview'
}
