import { isAdmin } from './isAdmin'
import { isPanelUser } from './isPanelUser'
import { readPublishedOrDraft } from './readPublishedOrDraft'

export const contentAccess = {
  read: readPublishedOrDraft,
  // Version documents are not status-filtered by `read`, so without this an
  // api-key could read drafts through the versions endpoints. Lock them to
  // panel users; the public site never needs version history.
  readVersions: isPanelUser,
  create: isAdmin,
  update: isAdmin,
  delete: isAdmin,
}
