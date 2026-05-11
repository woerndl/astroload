import { payloadSDK } from './sdk'
import { cacheHeader } from './sdk/cachedFetch'
import type { Locale, PageCollectionSlug } from './types'

export interface StaticPathItem {
  collection: PageCollectionSlug
  id: string | number
  paths: Partial<Record<Locale, string>>
  updatedAt: string
}

export interface StaticPageParams {
  params: { lang: string; path: string | undefined }
  props: {
    id: string | number
    collection: PageCollectionSlug
    paths: Partial<Record<Locale, string>>
  }
}

export async function getStaticPathItems(): Promise<StaticPathItem[]> {
  const response = await payloadSDK.request({
    method: 'GET',
    path: '/static-paths',
    init: { headers: cacheHeader(true) },
  })

  if (!response.ok) {
    throw new Error(`static-paths fetch failed: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as StaticPathItem[]
}

export async function getStaticPaths(): Promise<StaticPageParams[]> {
  const items = await getStaticPathItems()
  const out: StaticPageParams[] = []

  for (const item of items) {
    for (const [lang, fullPath] of Object.entries(item.paths)) {
      if (!fullPath) continue
      const prefix = `/${lang}`
      const trimmed = fullPath.startsWith(prefix)
        ? fullPath.slice(prefix.length) || undefined
        : fullPath
      out.push({
        params: { lang, path: trimmed },
        props: { id: item.id, collection: item.collection, paths: item.paths },
      })
    }
  }

  return out
}
