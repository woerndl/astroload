import type { RedirectsCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { isAuthenticated } from '../access/isAuthenticated'
import {
  triggerDeployAlwaysAfterChange,
  triggerDeployAlwaysAfterDelete,
} from '../hooks/triggerDeploy'
import { CollectionGroups } from '../shared'

// Redirects have no draft state, so contentAccess does not apply. Read-only
// API keys need read access so the website can apply redirects. Astro reads
// them when it evaluates its config, so a change takes effect with the next
// deploy (or dev restart), which the hooks below trigger.
export const Redirects: RedirectsCollectionConfig = {
  slug: 'redirects',
  admin: {
    group: CollectionGroups.System,
  },
  access: {
    read: isAuthenticated,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: {
    afterChange: [triggerDeployAlwaysAfterChange],
    afterDelete: [triggerDeployAlwaysAfterDelete],
  },
  redirects: {},
  // The pages plugin adds sourcePath, destinationPath, type, and reason.
  fields: [],
}
