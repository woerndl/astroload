import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { contentAccess } from '../access/contentAccess'
import {
  triggerDeployAfterChange,
  triggerDeployAfterDelete,
} from '../hooks/triggerDeploy'
import { AUTOSAVE_INTERVAL, livePreviewBreakpoints } from '../shared'

export const Authors: PageCollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'path', 'updatedAt', '_status'],
    livePreview: { breakpoints: [...livePreviewBreakpoints] },
  },
  versions: {
    drafts: {
      autosave: { interval: AUTOSAVE_INTERVAL },
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
  // bio is left out of defaultPopulate so resolving authors on a post
  // list does not pull a localized rich-text body.
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
