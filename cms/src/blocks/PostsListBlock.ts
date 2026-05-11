import type { Block } from 'payload'

export const PostsListBlock: Block = {
  slug: 'postsList',
  interfaceName: 'PostsListBlock',
  labels: {
    singular: 'Posts List',
    plural: 'Posts Lists',
  },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'posts',
      type: 'relationship',
      relationTo: 'posts',
      hasMany: true,
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [
          async ({ req: { payload, locale } }) => {
            const { docs } = await payload.find({
              collection: 'posts',
              limit: 0,
              pagination: false,
              locale,
              where: { _status: { equals: 'published' } },
              sort: '-publishedAt',
            })
            return docs.map((doc) => doc.id)
          },
        ],
      },
    },
  ],
}
