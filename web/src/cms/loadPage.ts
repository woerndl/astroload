import { getGlobalData } from './getGlobalData'
import { getPageByPath, type PageByPathResult } from './getPageByPath'
import { getPageData } from './getPageData'
import type { StaticPageParams } from './getStaticPaths'
import type { Locale, LocalePaths, PageCollectionSlug } from './types'

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

// The shared body of the two catch-all routes. Returns null for a 404.
export async function loadCatchAllPage({
  locale,
  fullPath,
  props,
  locals,
}: {
  locale: Locale
  fullPath: string
  props: Partial<StaticPageParams['props']>
  locals: App.Locals
}): Promise<{ result: PageByPathResult; paths: LocalePaths | undefined } | null> {
  // Kick off global data now so it overlaps the page fetch. The layout awaits
  // the same Astro.locals memo (see getGlobalData).
  const globalData = getGlobalData({ locale, preview: false, locals })

  const { id, collection, paths } = props
  let result: PageByPathResult | null = null
  let resolvedPaths: LocalePaths | undefined = paths

  if (id && collection) {
    result = await loadPageResult(collection, id, locale)
  } else {
    // Dev renders the catch-all routes on demand (see prerenderOverrides in
    // astro.config.mjs) and gets no getStaticPaths props, so every dev request
    // resolves by path here, against the live CMS.
    const found = await getPageByPath(fullPath)
    if (found) {
      result = found
      resolvedPaths = found.paths
    }
  }

  if (!result) {
    // A 404 renders no layout, so nothing awaits the global-data fetch kicked
    // off above. Swallow it so a globals failure can't turn this into a 500.
    void globalData.catch(() => {})
    return null
  }
  await globalData
  return { result, paths: resolvedPaths }
}
