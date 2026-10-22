import type { CollectionSlug, DataFromCollectionSlug, Payload, Where } from 'payload'

import type { Locale, PageTemplate } from './shared'

interface UpsertByKeyArgs<T extends CollectionSlug> {
  collection: T
  // Must match at most one document, e.g. { slug: { equals: 'kontakt' } }.
  // More than one match throws.
  where: Where
  data: Partial<DataFromCollectionSlug<T>>
  locale?: Locale
  context?: Record<string, unknown>
}

// Find-or-create keyed on a stable field, so a re-run of a content seed
// updates the same documents instead of duplicating them. The lookup includes
// drafts, so an unpublished document is updated too. A re-run therefore
// overwrites an editor's newer draft, and a script that may run after editors
// take over needs its own policy, such as skipping existing documents or
// writing only empty fields. Find and create are not atomic, so seed runs must
// not overlap.
export async function upsertByKey<T extends CollectionSlug>(
  payload: Payload,
  { collection, where, data, locale, context }: UpsertByKeyArgs<T>,
): Promise<DataFromCollectionSlug<T>> {
  // The calls set overrideAccess explicitly, so they do not depend on the Local
  // API default.
  const existing = await payload.find({
    collection,
    where,
    locale,
    context,
    overrideAccess: true,
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

  // Payload's generated create and update types do not fit partial per-locale
  // writes. seed.ts uses the same cast in seedData.
  const match = existing.docs[0]
  if (match) {
    return payload.update({
      collection,
      id: match.id,
      data: data as never,
      locale,
      context,
      overrideAccess: true,
    })
  }
  return payload.create({ collection, data: data as never, locale, context, overrideAccess: true })
}

// Creates or updates the one Pages document of a template, one locale per call.
// context.seed lets the write set the slug, parent and root state that the
// Pages guards keep fixed for editors. Example for a home template:
// await seedTemplatedPage(payload, 'home', 'en', { title: 'Home', slug: '', isRootPage: true, _status: 'published' })
export function seedTemplatedPage(
  payload: Payload,
  template: PageTemplate,
  locale: Locale,
  data: Partial<DataFromCollectionSlug<'pages'>>,
) {
  return upsertByKey(payload, {
    collection: 'pages',
    where: { template: { equals: template } },
    data: { ...data, template },
    locale,
    context: { seed: true },
  })
}
