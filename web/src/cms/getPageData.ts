import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import { stripLocalePathsDeep } from './types'
import type { Locale, PageCollectionSlug, PageData } from './types'

export async function getPageData(
  collection: PageCollectionSlug,
  id: string | number,
  locale: Locale,
): Promise<PageData | null> {
  const result = await payloadSDK.find(
    {
      collection,
      locale,
      where: {
        id: { equals: id },
        _status: { equals: 'published' },
      },
      limit: 1,
      pagination: false,
    },
    { headers: cacheHeader(true) },
  )

  const doc = (result.docs[0] as PageData | undefined) ?? null
  // Generic find returns the stored prefixed `path` on the doc, its breadcrumbs,
  // populated relations, and rich-text internal links. Normalize them all so
  // single-locale pages render un-prefixed hrefs.
  return doc ? stripLocalePathsDeep(doc) : null
}
