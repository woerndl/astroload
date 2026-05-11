import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { triggerDeployGlobalAfterChange } from '../hooks/triggerDeploy'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [triggerDeployGlobalAfterChange],
  },
  fields: [
    {
      name: 'links',
      type: 'array',
      fields: [
        {
          name: 'page',
          type: 'relationship',
          relationTo: ['pages', 'posts', 'authors'],
          required: true,
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
        },
      ],
    },
  ],
}
