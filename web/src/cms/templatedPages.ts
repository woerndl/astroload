import type { Page } from '@astroload/cms/src/payload-types'

import type { PageByPathResult } from './getPageByPath'
import type { StaticPathItem } from './getStaticPaths'
import type { Locale } from './types'

export type TemplatedPageResult = Extract<PageByPathResult, { collection: 'pages' }> & {
  data: Page & { template: Exclude<Page['template'], 'default'> }
}

// A Pages document whose body is a component in TemplatedBody.astro.
export function isTemplatedPage(result: PageByPathResult): result is TemplatedPageResult {
  return result.collection === 'pages' && (result.data.template ?? 'default') !== 'default'
}

// Each template needs a published document with a path in every locale, or its
// page would drop out of the build without an error.
export function missingTemplates(
  items: Pick<StaticPathItem, 'template' | 'paths'>[],
  templates: readonly string[],
  locales: readonly Locale[],
): string[] {
  return templates.flatMap((template) =>
    locales
      .filter((locale) => !items.some((item) => item.template === template && item.paths[locale]))
      .map((locale) => `${template} (${locale})`),
  )
}
