import type { Access, AccessArgs } from 'payload'

// Version history is an admin-panel concern. Only real panel users (admins and
// editors) may read versions. API keys, including the preview key, never can,
// so a read-only key cannot reach drafts through the versions endpoints.
export const isPanelUser: Access = ({ req: { user } }: AccessArgs): boolean =>
  Boolean(user && user.collection === 'users')
