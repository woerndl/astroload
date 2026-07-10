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
      // Passing req keeps the find inside the request's transaction. It keeps
      // Payload's default access bypass on purpose: the where clause already
      // pins published docs, and the seed reads run without a user, which
      // `overrideAccess: false` would turn into a Forbidden error.
      async ({ req }) => {
        const { docs } = await req.payload.find({
          collection: relationTo,
          // Only the ids are used, so skip relation population and every
          // non-id field. An empty select is include-mode, returning id alone.
          depth: 0,
          select: {},
          limit: 0,
          pagination: false,
          locale: req.locale,
          where: { _status: { equals: 'published' } },
          sort,
          req,
        })
        return docs.map((doc) => doc.id)
      },
    ],
  },
})
