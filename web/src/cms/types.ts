import type { Author, Page, Post } from '@astroload/cms/src/payload-types'
import { isLocale, type Locale, type PageCollectionSlug } from '@astroload/cms/src/shared'

export { isLocale, type Locale, type PageCollectionSlug }
export type PageData = Page | Post | Author

export interface PreviewContext {
  collection: PageCollectionSlug
  id: string | number
}
