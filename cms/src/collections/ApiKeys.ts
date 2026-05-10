import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const ApiKeys: CollectionConfig = {
  slug: 'api-keys',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'enableAPIKey'],
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
      saveToJWT: true,
      defaultValue: 'read-only',
      options: [
        { label: 'Read-only (published content)', value: 'read-only' },
        { label: 'Preview (drafts + published)', value: 'preview' },
      ],
    },
  ],
}
