// Last good value per on-demand SSR route, so a route can keep serving when
// its CMS read fails. A plain Map is enough while keys are fixed route
// labels, because its size stays the number of opt-in routes. Key it by
// something high-cardinality (per path, per user) and it must become an
// LRUCache (see cache.ts) to bound the memory.
const lastGood = new Map<string, unknown>()

export interface StaleResult<T> {
  data: T
  stale: boolean
}

// Fetch fresh on every call. If the fetch throws (CMS down, timeout), serve the
// last good value for this key instead, flagged stale. On a cold start with no
// prior value the error propagates, because there is nothing to fall back to.
// Concurrent calls are not deduped, so "last good" is whichever fetch completes
// last. That is fine here because every fetch is a live read of the same data.
export async function staleOnError<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<StaleResult<T>> {
  try {
    const data = await fetcher()
    lastGood.set(key, data)
    return { data, stale: false }
  } catch (err) {
    if (!lastGood.has(key)) throw err
    return { data: lastGood.get(key) as T, stale: true }
  }
}
