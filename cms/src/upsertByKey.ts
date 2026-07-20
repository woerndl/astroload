import type { CollectionSlug, DataFromCollectionSlug, Payload, Where } from 'payload'

import type { Locale } from './shared'

interface UpsertByKeyArgs<T extends CollectionSlug> {
  collection: T
  // Stable identity of the document, e.g. { slug: { equals: 'kontakt' } }.
  // Must stay unique within the collection. With more than one match the
  // helper throws rather than update an arbitrary one.
  where: Where
  data: Partial<DataFromCollectionSlug<T>>
  locale?: Locale
}

// Find-or-create keyed on a stable field, the primitive that makes bulk
// content seeds idempotent: a re-run converges on the same documents instead
// of duplicating them. The lookup includes drafts so an unpublished document
// is updated, not shadowed by a new copy. The same inclusion means a re-run
// overwrites an editor's newer draft with the script's values, so a script
// that may run after editors own the content needs a policy on top: skip
// existing documents, or write only empty fields. Idempotency is sequential:
// the find-then-create is not atomic, so seed runs must not overlap.
export async function upsertByKey<T extends CollectionSlug>(
  payload: Payload,
  { collection, where, data, locale }: UpsertByKeyArgs<T>,
): Promise<DataFromCollectionSlug<T>> {
  const existing = await payload.find({
    collection,
    where,
    locale,
    draft: true,
    limit: 2,
    pagination: false,
    depth: 0,
  })
  if (existing.docs.length > 1) {
    throw new Error(
      `upsertByKey: multiple ${collection} documents match ${JSON.stringify(where)}, expected at most one`,
    )
  }

  // Payload's generated create/update types describe the union of every
  // collection's fields, which partial per-locale writes don't fit. The
  // casts are the seed's `seedData` opt-out, generic here.
  const match = existing.docs[0]
  if (match) {
    return payload.update({ collection, id: match.id, data: data as never, locale })
  }
  return payload.create({ collection, data: data as never, locale })
}
