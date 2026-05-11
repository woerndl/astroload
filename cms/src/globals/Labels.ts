import type { GlobalConfig, TextField } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { triggerDeployGlobalAfterChange } from '../hooks/triggerDeploy'

const labelField = (name: string, label?: string): TextField => ({
  name,
  type: 'text',
  required: true,
  localized: true,
  label,
})

export const Labels: GlobalConfig = {
  slug: 'labels',
  dbName: 'labels',
  typescript: { interface: 'Labels' },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [triggerDeployGlobalAfterChange],
  },
  fields: [
    {
      name: 'global',
      type: 'group',
      fields: [
        labelField('readMore'),
        labelField('learnMore'),
        labelField('openMenu'),
        labelField('closeMenu'),
      ],
    },
    {
      name: 'posts',
      type: 'group',
      fields: [labelField('writtenBy'), labelField('lastUpdatedAt')],
    },
    {
      name: 'notFound',
      type: 'group',
      label: 'Not found (404) page',
      fields: [
        labelField('title'),
        labelField('description'),
        labelField('homePageButton'),
      ],
    },
    {
      name: 'preview',
      type: 'group',
      label: 'Live preview toolbar',
      fields: [labelField('editingDraft'), labelField('openInAdmin')],
    },
  ],
}
