import type { Block } from 'payload'

export const AuthorsListBlock: Block = {
  slug: 'authorsList',
  interfaceName: 'AuthorsListBlock',
  labels: {
    singular: 'Authors List',
    plural: 'Authors Lists',
  },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'authors',
      hasMany: true,
      virtual: true,
      admin: { hidden: true },
      hooks: {
        afterRead: [
          async ({ req: { payload, locale } }) => {
            const { docs } = await payload.find({
              collection: 'authors',
              limit: 0,
              pagination: false,
              locale,
              where: { _status: { equals: 'published' } },
              sort: 'name',
            })
            return docs.map((doc) => doc.id)
          },
        ],
      },
    },
  ],
}
