import type { Access, AccessArgs } from 'payload'

// Separate from isPanelUser so a later read-only panel role gets no write access.
export const isAdminOrEditor: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(
    user &&
    user.collection === 'users' &&
    user.roles?.some((role) => role === 'admin' || role === 'editor'),
  )
}
