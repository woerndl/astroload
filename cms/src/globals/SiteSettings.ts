import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { triggerDeployGlobalAfterChange } from '../hooks/triggerDeploy'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [triggerDeployGlobalAfterChange],
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'defaultSeo',
      type: 'group',
      fields: [
        {
          name: 'titleSuffix',
          type: 'text',
          localized: true,
        },
        {
          name: 'description',
          type: 'textarea',
          localized: true,
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'robots',
      type: 'group',
      fields: [
        {
          name: 'allowIndexing',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Off in dev/staging by default. Turn on once the site is ready for search engines.',
          },
        },
      ],
    },
  ],
}
