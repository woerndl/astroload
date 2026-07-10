import type { GlobalConfig } from 'payload'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { triggerDeployGlobalAfterChange } from '../hooks/triggerDeploy'

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
