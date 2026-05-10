import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { contentAccess } from '../access/contentAccess'

export const Posts: PageCollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'path', 'updatedAt', '_status'],
  },
  versions: {
    drafts: true,
  },
  access: contentAccess,
  page: {
    parent: {
      collection: 'pages',
      name: 'parent',
      sharedDocument: true,
    },
  },
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
    },
  ],
}
