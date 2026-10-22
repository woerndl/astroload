import type { StaticPathItem } from '@astroload/cms/src/endpoints/staticPaths'

import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import { missingTemplates } from './templatedPages'
import { LOCALE_URL_PREFIX, LOCALES, pageTemplates } from './types'
import type { Locale, PageCollectionSlug } from './types'

export type { StaticPathItem }

export interface StaticPageParams {
  params: { lang?: string; path: string | undefined }
  props: {
    id: string | number
    collection: PageCollectionSlug
    paths: Partial<Record<Locale, string>>
    template?: string
  }
}

export async function getStaticPathItems(): Promise<StaticPathItem[]> {
  // The SDK throws on any non-ok response, so there is no status branch here.
  const response = await payloadSDK.request({
    method: 'GET',
    path: '/static-paths',
    init: { headers: cacheHeader(true) },
  })

  const items = (await response.json()) as StaticPathItem[]
  // Route enumeration, sitemaps and the home lookup trust this shape, so a
  // wrong shape fails here with a clear message instead of during a render.
  if (!Array.isArray(items)) {
    throw new Error('the static-paths endpoint did not return an array')
  }
  return items
}

export async function getStaticPaths(): Promise<StaticPageParams[]> {
  const items = await getStaticPathItems()
  const missing = missingTemplates(items, pageTemplates, LOCALES)
  if (missing.length > 0) {
    throw new Error(`templates without a published page: ${missing.join(', ')}`)
  }
  const out: StaticPageParams[] = []

  for (const item of items) {
    for (const [lang, fullPath] of Object.entries(item.paths)) {
      if (!fullPath) continue
      const props = {
        id: item.id,
        collection: item.collection,
        paths: item.paths,
        template: item.template,
      }
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
