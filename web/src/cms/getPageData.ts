import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import type { Locale, PageCollectionSlug, PageData } from './types'

export async function getPageData(
  collection: PageCollectionSlug,
  id: string | number,
  locale: Locale,
  options?: { preview?: boolean },
): Promise<PageData> {
  const preview = options?.preview ?? false

  const result = await payloadSDK.find(
    {
      collection,
      locale,
      draft: preview,
      where: {
        id: { equals: id },
        _status: preview ? { in: ['draft', 'published'] } : { equals: 'published' },
      },
      limit: 1,
      pagination: false,
    },
    {
      headers: cacheHeader(!preview),
    },
  )

  if (result.totalDocs === 0) {
    throw new Error(`Page not found: collection=${String(collection)} id=${String(id)}`)
  }

  return result.docs[0] as unknown as PageData
}
