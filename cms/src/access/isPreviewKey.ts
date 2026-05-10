import type { Access, AccessArgs } from 'payload'

export const isPreviewKey: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(
    user && user.collection === 'api-keys' && user.type === 'preview',
  )
}
