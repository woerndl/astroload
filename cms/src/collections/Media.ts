import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { CollectionGroups } from '../shared'

// Convert generated images to WebP. og stays JPEG because some social-card
// scrapers still do not render a WebP og:image.
const toWebp = { format: 'webp' as const, options: { quality: 80 } }
const ogJpeg = { format: 'jpeg' as const, options: { quality: 82 } }

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
    formatOptions: toWebp,
    imageSizes: [
      { name: 'xs', width: 480, formatOptions: toWebp },
      { name: 'sm', width: 768, formatOptions: toWebp },
      { name: 'md', width: 1024, formatOptions: toWebp },
      { name: 'lg', width: 1920, formatOptions: toWebp },
      // withoutEnlargement keeps the og variant for sources smaller than the
      // target, so og:image never falls through to the WebP main file.
      {
        name: 'og',
        width: 1200,
        height: 630,
        position: 'center',
        formatOptions: ogJpeg,
        withoutEnlargement: true,
      },
    ],
    // The web app appends ?v=updatedAt to every media url, so the bytes for a
    // given url never change and can be cached hard. 30 days, not immutable:
    // max-age bounds the one path the version marker cannot see, a variant
    // regeneration that rewrites file bytes without touching updatedAt.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=2592000')
    },
  },
}
