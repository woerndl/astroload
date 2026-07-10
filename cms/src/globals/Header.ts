import type { GlobalConfig } from 'payload'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { triggerDeployGlobalAfterChange } from '../hooks/triggerDeploy'
import { navLinkFields } from '../shared'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    update: isAdminOrEditor,
  },
  hooks: {
    afterChange: [triggerDeployGlobalAfterChange],
  },
  fields: [
    {
      name: 'links',
      type: 'array',
      fields: navLinkFields,
    },
  ],
}
