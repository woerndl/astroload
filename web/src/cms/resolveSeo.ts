import type { Media } from '@astroload/cms/src/payload-types'

import { isPopulated, type PageData } from './types'

export interface ResolvedSeo {
  title: string
  description?: string
  image?: Media | null
}

export function resolveSeo(data: PageData): ResolvedSeo {
  const title = data.meta?.title || ('title' in data ? data.title : data.name) || ''
  const description = data.meta?.description || ('excerpt' in data ? data.excerpt : null) || undefined
  const image = isPopulated<Media>(data.meta?.image) ? data.meta.image : null
  return { title, description, image }
}
