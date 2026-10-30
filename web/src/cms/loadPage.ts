import { getGlobalData } from './getGlobalData'
import { getPageByPath, type PageByPathResult } from './getPageByPath'
import { getPageData } from './getPageData'
import type { StaticPageParams } from './getStaticPaths'
import type { Locale, LocalePaths } from './types'

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
  // The page load can throw or end in a 404 before anything awaits globalData.
  void globalData.catch(() => {})

  const { id, collection, paths, template } = props
  if (!id || !collection) {
    const found = await getPageByPath(fullPath)
    if (!found) return null
    await globalData
    return { result: found, paths: found.paths }
  }

  // While prerendering, Astro skips a page without a body instead of failing the build.
  const data = await getPageData(collection, id, locale)
  if (!data) {
    throw new Error(`page ${collection}/${id} was enumerated but is no longer published`)
  }
  const actual =
    collection === 'pages' ? ((data as { template?: string }).template ?? 'default') : undefined
  if (actual !== template) {
    throw new Error(
      `page ${collection}/${id} was enumerated with template ${template} but has ${actual}`,
    )
  }
  if (data.path !== paths?.[locale]) {
    throw new Error(
      `page ${collection}/${id} moved from ${paths?.[locale]} to ${data.path} during the build`,
    )
  }
  await globalData
  return { result: { collection, data } as PageByPathResult, paths }
}
