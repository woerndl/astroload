import { isAdmin } from './isAdmin'
import { isAuthenticated } from './isAuthenticated'

export const contentAccess = {
  read: isAuthenticated,
  create: isAdmin,
  update: isAdmin,
  delete: isAdmin,
}
