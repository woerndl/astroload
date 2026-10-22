import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { contentAccess } from '../access/contentAccess'
import { triggerDeployAfterChange, triggerDeployAfterDelete } from '../hooks/triggerDeploy'
import { draftVersions, livePreviewBreakpoints } from '../shared'

export const Authors: PageCollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'path', 'updatedAt', '_status'],
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
  // bio is left out so a post list that populates authors does not load a
  // localized rich-text body per author.
  defaultPopulate: {
    name: true,
    path: true,
    role: true,
    photo: true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'role',
      type: 'text',
      localized: true,
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'richText',
      localized: true,
    },
  ],
}
