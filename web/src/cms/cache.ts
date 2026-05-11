interface CmsCache {
  readonly apiRequests: Map<string, string>
}

export const cache: CmsCache = {
  apiRequests: new Map(),
}

export function clearCache(): void {
  cache.apiRequests.clear()
}
