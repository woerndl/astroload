import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'
import { BlocksFeature } from '@payloadcms/richtext-lexical'

import { contentAccess } from '../access/contentAccess'
import { ImageBlock } from '../blocks/ImageBlock'
import { triggerDeployAfterChange, triggerDeployAfterDelete } from '../hooks/triggerDeploy'
import { lexicalEditorWithSafeLinks } from '../lexical/editor'
import { dateTimeField, draftVersions, livePreviewBreakpoints } from '../shared'

export const Posts: PageCollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'path', 'updatedAt', '_status'],
    livePreview: { breakpoints: [...livePreviewBreakpoints] },
  },
  versions: draftVersions,
  hooks: {
    afterChange: [triggerDeployAfterChange],
    afterDelete: [triggerDeployAfterDelete],
  },
  access: contentAccess,
  page: {
    parent: {
      collection: 'pages',
      name: 'parent',
      sharedDocument: true,
    },
  },
  // authors: true uses the Authors defaultPopulate, which leaves out bio.
  defaultPopulate: {
    title: true,
    path: true,
    excerpt: true,
    image: true,
    authors: true,
    publishedAt: true,
  },
  fields: [
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'authors',
      hasMany: true,
      required: true,
      minRows: 1,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: dateTimeField,
      },
      hooks: {
        beforeChange: [
          // Stamp the first publish time when the editor leaves the field
          // blank. A later publish keeps whatever value is already set.
          ({ data, value }) => (data?._status === 'published' && !value ? new Date() : value),
        ],
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      localized: true,
      editor: lexicalEditorWithSafeLinks([BlocksFeature({ blocks: [ImageBlock] })]),
    },
  ],
}
