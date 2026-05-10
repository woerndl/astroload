import { isAdmin } from './isAdmin'
import { readPublishedOrDraft } from './readPublishedOrDraft'

export const contentAccess = {
  read: readPublishedOrDraft,
  create: isAdmin,
  update: isAdmin,
  delete: isAdmin,
}
