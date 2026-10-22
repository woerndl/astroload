import { stripLocalePath, type Locale } from '../cms/types'

// Returns the public URL of a path written in code for a locale. It adds the
// locale prefix when LOCALE_URL_PREFIX is true. A stored document `path`
// already carries its locale and must not go through this, or the prefix
// doubles.
export function localePath(lang: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return stripLocalePath(clean === '/' ? `/${lang}` : `/${lang}${clean}`)
}
