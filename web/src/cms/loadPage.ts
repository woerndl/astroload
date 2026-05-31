import { getPageData } from './getPageData'
import type { PageByPathResult } from './getPageByPath'
import type { Locale, PageCollectionSlug } from './types'

// Build a render result from a static-path item's id and collection. Both
// catch-all routes need this shape for their prerendered branch, where Astro
// carries id/collection as props rather than resolving the page by path.
export async function loadPageResult(
  collection: PageCollectionSlug,
  id: string | number,
  locale: Locale,
): Promise<PageByPathResult | null> {
  const data = await getPageData(collection, id, locale)
  return data ? ({ collection, data } as PageByPathResult) : null
}
