import type { Block } from 'payload'

import { publishedRelationField } from './publishedRelationField'

export const AuthorsListBlock: Block = {
  slug: 'authorsList',
  interfaceName: 'AuthorsListBlock',
  labels: {
    singular: 'Authors List',
    plural: 'Authors Lists',
  },
  admin: { disableBlockName: true },
  fields: [publishedRelationField({ name: 'authors', relationTo: 'authors', sort: 'name' })],
}
