import type { Footer, Header, Labels, SiteSetting } from '@astroload/cms/src/payload-types'

import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import type { Locale } from './types'

export interface GlobalData {
  footer: Footer
  header: Header
  labels: Labels
  siteSettings: SiteSetting
}

async function fetchGlobalData(locale: Locale, preview: boolean): Promise<GlobalData> {
  const query = new URLSearchParams({ locale, preview: String(preview) })
  const response = await payloadSDK.request({
    method: 'GET',
    path: `/global-data?${query.toString()}`,
    init: { headers: cacheHeader(!preview) },
  })

  if (!response.ok) {
    throw new Error(`global-data fetch failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as GlobalData
  if (!data.header || !data.footer || !data.labels || !data.siteSettings) {
    throw new Error('global-data response is incomplete')
  }
  return data
}

export function getGlobalData({
  locale,
  preview,
  locals,
}: {
  locale: Locale
  preview: boolean
  locals?: App.Locals
}): Promise<GlobalData> {
  // Without a request scope (build-time prerender, endpoints), fetch directly;
  // the SDK LRU already dedupes repeat calls in production.
  if (!locals) return fetchGlobalData(locale, preview)

  // Memoize the in-flight promise on per-request Astro.locals so one render that
  // needs globals in several places makes a single CMS round-trip.
  const memo = (locals.globalData ??= new Map<string, Promise<GlobalData>>())

  const key = `${locale}:${preview}`
  const existing = memo.get(key)
  if (existing) return existing

  const promise = fetchGlobalData(locale, preview)
  memo.set(key, promise)
  return promise
}
