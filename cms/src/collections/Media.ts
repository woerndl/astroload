import path from 'path'
import type { CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import {
  triggerDeployAlwaysAfterChange,
  triggerDeployAlwaysAfterDelete,
} from '../hooks/triggerDeploy'
import { CollectionGroups } from '../shared'

// Convert generated images to WebP. og stays JPEG because some social-card
// scrapers still do not render a WebP og:image.
const toWebp = { format: 'webp' as const, options: { quality: 80 } }
const ogJpeg = { format: 'jpeg' as const, options: { quality: 82 } }

// Payload resolves a relative staticDir against the process working directory,
// so a server started from the repo root would read and write a different
// directory than one started from cms/. Pin the path to this package.
// MEDIA_DIR overrides it where the package path is not the right place for
// persistent files, such as a container with a volume mount.
const dirname = path.dirname(fileURLToPath(import.meta.url))
const mediaDir = process.env.MEDIA_DIR ?? path.resolve(dirname, '../../media')

export const Media: CollectionConfig = {
  slug: 'media',
  // Public read so the file route serves images without an api key.
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'mimeType', 'filesize', 'updatedAt'],
    group: CollectionGroups.Media,
  },
  hooks: {
    afterChange: [triggerDeployAlwaysAfterChange],
    afterDelete: [triggerDeployAlwaysAfterDelete],
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
    staticDir: mediaDir,
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
    // Applies to Payload's own file route, which serves media from local disk.
    // The web app appends ?v=updatedAt to every media url, so the bytes for a
    // given url never change and can be cached hard. 30 days, not immutable:
    // max-age bounds the one path the version marker cannot see, a variant
    // regeneration that rewrites file bytes without touching updatedAt. With S3
    // (disablePayloadAccessControl) this route is bypassed and the bucket or
    // CDN sets its own cache headers.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=2592000')
    },
  },
}
