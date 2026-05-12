import type { RedirectsCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { isAdmin } from '../access/isAdmin'
import { isAuthenticated } from '../access/isAuthenticated'
import {
  triggerDeployAlwaysAfterChange,
  triggerDeployAlwaysAfterDelete,
} from '../hooks/triggerDeploy'
import { CollectionGroups } from '../shared'

// Redirects has no draft/published state, so contentAccess does not apply.
// Read-only API keys need read so the website can apply redirects.
// Astro reads the table when its config is evaluated, so any save needs a
// new deploy (or a dev restart) to take effect. The hooks below fire the
// deploy webhook on every change.
export const Redirects: RedirectsCollectionConfig = {
  slug: 'redirects',
  admin: {
    group: CollectionGroups.System,
  },
  access: {
    read: isAuthenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [triggerDeployAlwaysAfterChange],
    afterDelete: [triggerDeployAlwaysAfterDelete],
  },
  redirects: {},
  // Source, destination, type, reason are added by the pages-plugin.
  fields: [],
}
