import type { Field } from 'payload'

import type { PageCollectionSlug } from '../shared'

// Virtual relationship whose value is resolved at read time to the published
// docs of `relationTo`, in the given sort order. The list blocks render these.
export const publishedRelationField = ({
  name,
  relationTo,
  sort,
}: {
  name: string
  relationTo: PageCollectionSlug
  sort: string
}): Field => ({
  name,
  type: 'relationship',
  relationTo,
  hasMany: true,
  virtual: true,
  admin: { hidden: true },
  hooks: {
    afterRead: [
      async ({ req: { payload, locale } }) => {
        const { docs } = await payload.find({
          collection: relationTo,
          limit: 0,
          pagination: false,
          locale,
          where: { _status: { equals: 'published' } },
          sort,
        })
        return docs.map((doc) => doc.id)
      },
    ],
  },
})
