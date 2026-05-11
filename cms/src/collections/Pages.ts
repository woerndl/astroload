import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'

import { contentAccess } from '../access/contentAccess'
import { AuthorsListBlock } from '../blocks/AuthorsListBlock'
import { FormBlock } from '../blocks/FormBlock'
import { ImageBlock } from '../blocks/ImageBlock'
import { PostsListBlock } from '../blocks/PostsListBlock'
import { RichTextBlock } from '../blocks/RichTextBlock'
import {
  triggerDeployAfterChange,
  triggerDeployAfterDelete,
} from '../hooks/triggerDeploy'
import { livePreviewBreakpoints } from '../shared'

export const Pages: PageCollectionConfig = {
  slug: 'pages',
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
    {
      name: 'sections',
      type: 'blocks',
      blocks: [RichTextBlock, ImageBlock, FormBlock, PostsListBlock, AuthorsListBlock],
    },
  ],
}
