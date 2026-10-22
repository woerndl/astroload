import { LRUCache } from 'lru-cache'

// Bounded so a long-running server does not grow it without limit. The TTL
// keeps on-demand routes, such as the per-locale sitemaps, from serving stale
// CMS data until eviction or a restart. cachedFetch skips the cache in dev.
export const cache = new LRUCache<string, string>({
  max: 1024,
  maxSize: 32 * 1024 * 1024,
  sizeCalculation: (value) => Buffer.byteLength(value, 'utf8'),
  ttl: 60 * 1000,
})
