// Last good value per on-demand route, so a route keeps serving when its CMS
// read fails. A plain Map is enough while the keys are fixed route labels.
// Keys per path or per user need an LRUCache (see cache.ts) to bound memory.
const lastGood = new Map<string, unknown>()

export interface StaleResult<T> {
  data: T
  stale: boolean
}

// When the fetch throws, serve the last good value for this key, flagged stale.
// With no prior value the error propagates. Concurrent calls are not
// deduplicated, so the fetch that completes last sets the last good value.
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
    // The page still renders, so without this log a failing CMS goes unnoticed.
    console.error(`[astroload] staleOnError serving stale '${key}':`, err)
    return { data: lastGood.get(key) as T, stale: true }
  }
}
