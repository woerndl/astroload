import type { Config } from './payload-types'

export type Locale = Config['locale']

export const LOCALES: readonly Locale[] = ['de', 'en']

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

export const pageCollectionsSlugs = ['pages', 'posts', 'authors'] as const

export type PageCollectionSlug = (typeof pageCollectionsSlugs)[number]

export const livePreviewBreakpoints = [
  { name: 'mobile', label: 'Mobile', width: 390, height: 844 },
  { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { name: 'desktop', label: 'Desktop', width: 1280, height: 800 },
] as const
