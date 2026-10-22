import type { Access, AccessArgs } from 'payload'

// For read access only. API keys also pass this check.
export const isAuthenticated: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(user)
}
