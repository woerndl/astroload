import type { Access, AccessArgs } from 'payload'

// Admin panel users (admins and editors). Every API key fails this check,
// including the preview key.
export const isPanelUser: Access = ({ req: { user } }: AccessArgs): boolean =>
  Boolean(user && user.collection === 'users')
