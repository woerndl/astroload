import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'columns',
      type: 'array',
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
          localized: true,
        },
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
    },
    {
      name: 'copyright',
      type: 'text',
      localized: true,
    },
  ],
}
