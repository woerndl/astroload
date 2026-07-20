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

export function createCachedFetch(baseFetch: typeof fetch): typeof fetch {
  return async function cachedFetch(input, init) {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'

    // The marker is SDK-internal routing, not part of the CMS request.
    const headers = new Headers(init?.headers)
    const useCache = headers.get(USE_CACHE_HEADER) === 'true'
    headers.delete(USE_CACHE_HEADER)
    // A stalled CMS would otherwise hold a build until the host kills it.
    // staleOnError handles the resulting rejection where a fallback exists.
    const cleanInit = { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(15_000) }

    // Disabled in dev so CMS edits propagate without an Astro restart.
    const shouldCache = useCache && method === 'GET' && !import.meta.env.DEV

    if (!shouldCache) return baseFetch(input, cleanInit)

    // Only GETs are cached, so the URL plus the auth identity is the whole key.
    const key = `${url}:${hashAuth(headers.get('authorization') ?? '')}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      return new Response(cached, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await baseFetch(input, cleanInit)
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const text = await response.clone().text()
      cache.set(key, text)
    }
    return response
  }
}
