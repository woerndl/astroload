import type { Footer, Header, Labels } from '@astroload/cms/src/payload-types'

import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import type { Locale } from './types'

export interface GlobalData {
  footer: Footer
  header: Header
  labels: Labels
}

export async function getGlobalData({
  locale,
  preview,
}: {
  locale: Locale
  preview: boolean
}): Promise<GlobalData> {
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
  if (!data.header || !data.footer || !data.labels) {
    throw new Error('global-data response is incomplete')
  }
  return data
}
