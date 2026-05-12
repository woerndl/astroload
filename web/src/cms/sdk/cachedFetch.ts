import { createHash } from 'crypto'

import { cache } from '../cache'

export const USE_CACHE_HEADER = 'X-Use-Cache'

export const cacheHeader = (useCache: boolean): Record<string, string> => ({
  [USE_CACHE_HEADER]: useCache ? 'true' : 'false',
})

// Hash the auth header into the key so rotating the API key invalidates old
// entries and the raw secret never appears in cache keys or diagnostics.
const hashAuth = (value: string): string =>
  value ? createHash('sha256').update(value).digest('hex').slice(0, 16) : ''

const createCacheKey = (url: string, init?: RequestInit): string => {
  const method = init?.method ?? 'GET'
  const body = init?.body ? String(init.body) : ''
  const headers = init?.headers ? new Headers(init.headers) : null
  const auth = hashAuth(headers?.get('authorization') ?? '')
  return `${method}:${url}:${body}:${auth}`
}

export function createCachedFetch(baseFetch: typeof fetch): typeof fetch {
  return async function cachedFetch(input, init) {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'
    const useCache = new Headers(init?.headers).get(USE_CACHE_HEADER) === 'true'

    // Disabled in dev so CMS edits propagate without an Astro restart.
    const shouldCache = useCache && method === 'GET' && !import.meta.env.DEV

    if (!shouldCache) return baseFetch(input, init)

    const key = createCacheKey(url, init)
    const cached = cache.get(key)
    if (cached !== undefined) {
      return new Response(cached, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await baseFetch(input, init)
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const text = await response.clone().text()
      cache.set(key, text)
    }
    return response
  }
}
