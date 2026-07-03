import { findPublicDocs } from './findPublicDocs'
import { cacheHeader } from './sdk/cachedFetch'
import type { Locale, PageCollectionSlug, PageData } from './types'

export async function getPageData(
  collection: PageCollectionSlug,
  id: string | number,
  locale: Locale,
): Promise<PageData | null> {
  const result = await findPublicDocs(
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

  return (result.docs[0] as PageData | undefined) ?? null
}
