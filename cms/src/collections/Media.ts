import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { CollectionGroups } from '../shared'

export const Media: CollectionConfig = {
  slug: 'media',
  // Public read so the file route serves images without an api key.
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'mimeType', 'filesize', 'updatedAt'],
    group: CollectionGroups.Media,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'caption',
      type: 'text',
      localized: true,
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
    adminThumbnail: 'xs',
    imageSizes: [
      { name: 'xs', width: 480 },
      { name: 'sm', width: 768 },
      { name: 'md', width: 1024 },
      { name: 'lg', width: 1920 },
      { name: 'og', width: 1200, height: 630, position: 'center' },
    ],
  },
}
