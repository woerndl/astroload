import { PayloadSDKError, type PayloadSDK } from '@payloadcms/sdk'
import type { Author, Config, Page, Post } from '@astroload/cms/src/payload-types'

import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'

export type PageByPathResult =
  | { collection: 'pages'; data: Page }
  | { collection: 'posts'; data: Post }
  | { collection: 'authors'; data: Author }

export async function getPageByPath(
  fullPath: string,
  options?: { preview?: boolean; sdk?: PayloadSDK<Config> },
): Promise<PageByPathResult | null> {
  const preview = options?.preview ?? false
  const sdk = options?.sdk ?? payloadSDK
  const query = new URLSearchParams({ path: fullPath, preview: String(preview) })

  let response: Response
  try {
    response = await sdk.request({
      method: 'GET',
      path: `/page-by-path?${query.toString()}`,
      init: { headers: cacheHeader(!preview) },
    })
  } catch (err) {
    if (err instanceof PayloadSDKError && err.status === 404) return null
    throw err
  }

  return (await response.json()) as PageByPathResult
}
