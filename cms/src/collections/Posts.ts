import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'
import { BlocksFeature } from '@payloadcms/richtext-lexical'

import { contentAccess } from '../access/contentAccess'
import { ImageBlock } from '../blocks/ImageBlock'
import {
  triggerDeployAfterChange,
  triggerDeployAfterDelete,
} from '../hooks/triggerDeploy'
import { lexicalEditorWithSafeLinks } from '../lexical/editor'
import { livePreviewBreakpoints } from '../shared'

export const Posts: PageCollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'path', 'updatedAt', '_status'],
    livePreview: { breakpoints: [...livePreviewBreakpoints] },
  },
  versions: {
    drafts: {
      autosave: { interval: 1500 },
      schedulePublish: false,
    },
  },
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
  // bio is heavy and localized, so leave it out of post-list author populates.
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
        date: { pickerAppearance: 'dayAndTime' },
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
