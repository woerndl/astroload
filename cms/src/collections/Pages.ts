import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { contentAccess } from '../access/contentAccess'

export const Pages: PageCollectionConfig = {
  slug: 'pages',
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
    },
    isRootCollection: true,
  },
  defaultPopulate: {
    title: true,
    path: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
  ],
}
