import { cache } from '../cache'

export const USE_CACHE_HEADER = 'X-Use-Cache'

export const cacheHeader = (useCache: boolean): Record<string, string> => ({
  [USE_CACHE_HEADER]: useCache ? 'true' : 'false',
})

const createCacheKey = (url: string, init?: RequestInit): string => {
  const method = init?.method ?? 'GET'
  const body = init?.body ? String(init.body) : ''
  const headers = init?.headers ? new Headers(init.headers) : null
  const auth = headers?.get('authorization') ?? ''
  return `${method}:${url}:${body}:${auth}`
}

export function createCachedFetch(baseFetch: typeof fetch): typeof fetch {
  return async function cachedFetch(input, init) {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'
    const useCache = new Headers(init?.headers).get(USE_CACHE_HEADER) === 'true'

    // The SDK cache is for SSG builds. `astro dev` runs the same code paths
    // but should always fetch fresh so CMS edits propagate without a restart.
    const shouldCache = useCache && method === 'GET' && !import.meta.env.DEV

    if (!shouldCache) return baseFetch(input, init)

    const key = createCacheKey(url, init)
    const cached = cache.apiRequests.get(key)
    if (cached !== undefined) {
      return new Response(cached, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await baseFetch(input, init)
    if (response.ok) {
      try {
        const text = await response.clone().text()
        JSON.parse(text)
        cache.apiRequests.set(key, text)
      } catch {
        // non-JSON body, skip caching
      }
    }
    return response
  }
}
