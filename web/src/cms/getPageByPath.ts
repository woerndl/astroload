import type { Author, Page, Post } from '@astroload/cms/src/payload-types'

import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'

export type PageByPathResult =
  | { collection: 'pages'; data: Page }
  | { collection: 'posts'; data: Post }
  | { collection: 'authors'; data: Author }

export async function getPageByPath(
  fullPath: string,
  options?: { preview?: boolean },
): Promise<PageByPathResult | null> {
  const preview = options?.preview ?? false
  const query = new URLSearchParams({ path: fullPath, preview: String(preview) })

  const response = await payloadSDK.request({
    method: 'GET',
    path: `/page-by-path?${query.toString()}`,
    init: { headers: cacheHeader(!preview) },
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`page-by-path fetch failed: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as PageByPathResult
}
