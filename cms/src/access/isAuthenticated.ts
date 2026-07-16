import type { Access, AccessArgs } from 'payload'

// Read-only. Using this for writes would let API keys mutate data.
export const isAuthenticated: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(user)
}
