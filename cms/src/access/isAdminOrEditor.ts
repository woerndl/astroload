import type { Access, AccessArgs } from 'payload'

// Admins and editors may edit content. This remains separate from isPanelUser
// so a later read-only panel role does not gain write access.
export const isAdminOrEditor: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(
    user &&
      user.collection === 'users' &&
      user.roles?.some((role) => role === 'admin' || role === 'editor'),
  )
}
