import type { Author, Config, Page, Post } from '@astroload/cms/src/payload-types'

export type Locale = Config['locale']
export type PageCollectionSlug = keyof Config['collections']
export type PageData = Page | Post | Author
