import type { Access, AccessArgs } from 'payload'

// Read-only. Gating a write with this would let api-keys mutate data.
export const isAuthenticated: Access = ({ req: { user } }: AccessArgs): boolean => {
  return Boolean(user)
}
