import path from 'path'
import type { CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'

import { isAdminOrEditor } from '../access/isAdminOrEditor'
import {
  triggerDeployAlwaysAfterChange,
  triggerDeployAlwaysAfterDelete,
} from '../hooks/triggerDeploy'
import { CollectionGroups } from '../shared'

// og stays JPEG because some social card scrapers do not render a WebP og:image.
const toWebp = { format: 'webp' as const, options: { quality: 80 } }
const ogJpeg = { format: 'jpeg' as const, options: { quality: 82 } }

// Payload resolves a relative staticDir against the working directory, so the
// path is pinned to this package. MEDIA_DIR overrides it, for example to point
// at a container volume.
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
      // withoutEnlargement still generates og for a source smaller than the
      // target, so og:image does not fall back to the WebP original.
      {
        name: 'og',
        width: 1200,
        height: 630,
        position: 'center',
        formatOptions: ogJpeg,
        withoutEnlargement: true,
      },
    ],
    // Applies to Payload's file route, which serves local files or proxies
    // them from S3. The web app adds ?v=updatedAt to media URLs, so an update
    // changes the URL and the file can be cached for 30 days. max-age stays
    // finite because regenerating variants can change the bytes without
    // touching updatedAt. The direct S3 mode (disablePayloadAccessControl, see
    // docs/astroload/deployment.md) skips this route, and there the bucket or
    // CDN sets the cache headers.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=2592000')
    },
  },
}
