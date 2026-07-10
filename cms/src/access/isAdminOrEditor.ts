import type { Access, AccessArgs } from 'payload'

// The write tier for content: both shipped roles may edit. Kept separate from
// isPanelUser so a later read-only panel role does not gain writes by
// accident.
export const isAdminOrEditor: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(
    user &&
      user.collection === 'users' &&
      user.roles?.some((role) => role === 'admin' || role === 'editor'),
  )
}
