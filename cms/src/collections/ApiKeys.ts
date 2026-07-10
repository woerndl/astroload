import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { CollectionGroups } from '../shared'

export const ApiKeys: CollectionConfig = {
  slug: 'api-keys',
  labels: {
    singular: 'API Key',
    plural: 'API Keys',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'enableAPIKey'],
    group: CollectionGroups.System,
  },
  auth: {
    useAPIKey: true,
    disableLocalStrategy: true,
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'read-only',
      options: [
        { label: 'Read-only (published content)', value: 'read-only' },
        { label: 'Preview (drafts + published)', value: 'preview' },
      ],
    },
  ],
}
