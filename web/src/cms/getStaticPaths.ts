import type { StaticPathItem } from '@astroload/cms/src/endpoints/staticPaths'

import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import { LOCALE_URL_PREFIX } from './types'
import type { Locale, PageCollectionSlug } from './types'

export type { StaticPathItem }

export interface StaticPageParams {
  params: { lang?: string; path: string | undefined }
  props: {
    id: string | number
    collection: PageCollectionSlug
    paths: Partial<Record<Locale, string>>
  }
}

export async function getStaticPathItems(): Promise<StaticPathItem[]> {
  // The SDK throws on any non-ok response, so there is no status branch here.
  const response = await payloadSDK.request({
    method: 'GET',
    path: '/static-paths',
    init: { headers: cacheHeader(true) },
  })

  return (await response.json()) as StaticPathItem[]
}

export async function getStaticPaths(): Promise<StaticPageParams[]> {
  const items = await getStaticPathItems()
  const out: StaticPageParams[] = []

  for (const item of items) {
    for (const [lang, fullPath] of Object.entries(item.paths)) {
      if (!fullPath) continue
      const props = { id: item.id, collection: item.collection, paths: item.paths }
      if (LOCALE_URL_PREFIX) {
        const prefix = `/${lang}`
        const trimmed = fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath
        // Rest params carry no leading slash. The locale home ('/de') maps to
        // an undefined rest param.
        out.push({ params: { lang, path: trimmed.replace(/^\//, '') || undefined }, props })
      } else {
        // The endpoint already stripped the prefix. '/' is the home page, which
        // index.astro owns, so the catch-all route skips it.
        if (fullPath === '/') continue
        out.push({ params: { path: fullPath.replace(/^\//, '') }, props })
      }
    }
  }

  return out
}
