import type { RedirectsCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { isAdmin } from '../access/isAdmin'
import { isAuthenticated } from '../access/isAuthenticated'

// Redirects has no draft/published state, so contentAccess does not apply.
// Read-only API keys need read so the website can apply redirects.
export const Redirects: RedirectsCollectionConfig = {
  slug: 'redirects',
  access: {
    read: isAuthenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  redirects: {},
  // Source, destination, type, reason are added by the pages-plugin.
  fields: [],
}
