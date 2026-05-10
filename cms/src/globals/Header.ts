import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    update: isAdmin,
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
