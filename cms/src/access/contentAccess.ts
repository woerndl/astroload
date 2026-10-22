import { isAdminOrEditor } from './isAdminOrEditor'
import { isPanelUser } from './isPanelUser'
import { readPublishedOrDraft } from './readPublishedOrDraft'

export const contentAccess = {
  read: readPublishedOrDraft,
  // `read` does not filter version documents by status, so API keys would
  // reach drafts through the versions endpoints.
  readVersions: isPanelUser,
  create: isAdminOrEditor,
  update: isAdminOrEditor,
  delete: isAdminOrEditor,
}
