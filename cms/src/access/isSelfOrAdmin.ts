import type { Access, AccessArgs } from 'payload'

import { isAdmin } from './isAdmin'

export const isSelfOrAdmin: Access = (args: AccessArgs): boolean => {
  const { id, req } = args
  const { user } = req
  if (
    user?.collection === 'users' &&
    id !== undefined &&
    String(user.id) === String(id)
  ) {
    return true
  }
  return isAdmin(args) === true
}
