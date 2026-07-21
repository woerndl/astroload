import { LRUCache } from 'lru-cache'

// Bounded so a long-running SSR process can't grow this without limit across
// requests. Skipped in dev (see cachedFetch) so CMS edits show up without
// restarting Astro. The TTL exists for the on-demand routes (the per-locale
// sitemaps and any SSR opt-in): without it a long-running server serves
// stale responses until eviction or restart.
export const cache = new LRUCache<string, string>({
  max: 1024,
  maxSize: 32 * 1024 * 1024,
  sizeCalculation: (value) => Buffer.byteLength(value, 'utf8'),
  ttl: 60 * 1000,
})
