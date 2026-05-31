import type { Config } from './payload-types'
import { LOCALES } from './site-config'

export type Locale = Config['locale']

export { LOCALES, DEFAULT_LOCALE, LOCALE_URL_PREFIX, SITE_NAME } from './site-config'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

export const pageCollectionsSlugs = ['pages', 'posts', 'authors'] as const

export type PageCollectionSlug = (typeof pageCollectionsSlugs)[number]

export type LocalePaths = Partial<Record<Locale, string>>

export const AUTOSAVE_INTERVAL = 1500

export const livePreviewBreakpoints = [
  { name: 'mobile', label: 'Mobile', width: 390, height: 844 },
  { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { name: 'desktop', label: 'Desktop', width: 1280, height: 800 },
] as const

// Pages, Posts, and Authors stay in the default Collections group, so only
// the custom groups are listed here.
export const CollectionGroups = {
  Media: {
    de: 'Medien',
    en: 'Media',
  },
  System: {
    de: 'System',
    en: 'System',
  },
} as const
