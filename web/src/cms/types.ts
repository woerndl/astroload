import type { Author, Page, Post } from '@astroload/cms/src/payload-types'
import {
  isLocale,
  type Locale,
  type LocalePaths,
  type PageCollectionSlug,
} from '@astroload/cms/src/shared'

export { isLocale, type Locale, type LocalePaths, type PageCollectionSlug }
export type PageData = Page | Post | Author

export interface PreviewContext {
  collection: PageCollectionSlug
  id: string | number
}

export function isPopulated<T extends object>(value: number | T | null | undefined): value is T {
  return typeof value === 'object' && value !== null
}
