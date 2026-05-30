import type { Block } from 'payload'

import { publishedRelationField } from './publishedRelationField'

export const PostsListBlock: Block = {
  slug: 'postsList',
  interfaceName: 'PostsListBlock',
  labels: {
    singular: 'Posts List',
    plural: 'Posts Lists',
  },
  admin: { disableBlockName: true },
  fields: [publishedRelationField({ name: 'posts', relationTo: 'posts', sort: '-publishedAt' })],
}
