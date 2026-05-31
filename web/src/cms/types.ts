import type { Author, Page, Post } from '@astroload/cms/src/payload-types'
import {
  isLocale,
  type Locale,
  type LocalePaths,
  type PageCollectionSlug,
} from '@astroload/cms/src/shared'

export { isLocale, type Locale, type LocalePaths, type PageCollectionSlug }
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_URL_PREFIX,
  SITE_NAME,
} from '@astroload/cms/src/site-config'
export { stripLocalePath, stripLocalePathsDeep } from '@astroload/cms/src/stripLocalePath'
export type PageData = Page | Post | Author

export interface PreviewContext {
  collection: PageCollectionSlug
  id: string | number
}

export function isPopulated<T extends object>(value: number | T | null | undefined): value is T {
  return typeof value === 'object' && value !== null
}

type NavLink = {
  page: { value: number | Page | Post | Author }
  label: string
}

export interface ResolvedNavLink {
  href: string
  label: string
}

// Resolve Header/Footer nav links to href + label, dropping any whose target is
// unpopulated (a raw id) or pathless.
export function resolveNavLinks(links: NavLink[] | null | undefined): ResolvedNavLink[] {
  return (links ?? [])
    .map((link) => {
      const target = link.page.value
      return isPopulated(target) && target.path
        ? { href: target.path, label: link.label }
        : null
    })
    .filter((link): link is ResolvedNavLink => link !== null)
}
