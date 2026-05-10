import type { Access, AccessArgs } from 'payload'

export const isReadOnlyKey: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(
    user && user.collection === 'api-keys' && user.type === 'read-only',
  )
}
