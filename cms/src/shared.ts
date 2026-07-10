import type { CollectionConfig, Field } from 'payload'

import type { Config } from './payload-types'
import { LOCALES } from './site-config'

export type Locale = Config['locale']

export { LOCALES, DEFAULT_LOCALE, LOCALE_URL_PREFIX } from './site-config'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

// Schemes a rich-text link may use. The CMS validator
// (cms/src/lexical/editor.ts) rejects everything else at authoring, and the
// web sanitizer (web/src/components/lexical/sanitizeLinks.ts) unwraps
// anything that slips past it (imports, seeds, autosaved drafts). Both sides
// key off this list.
export const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

export const pageCollectionsSlugs = ['pages', 'posts', 'authors'] as const

export type PageCollectionSlug = (typeof pageCollectionsSlugs)[number]

export type LocalePaths = Partial<Record<Locale, string>>

const AUTOSAVE_INTERVAL = 1500

// Shared draft config for the page-like collections. maxPerDoc caps the stored
// version history so autosave does not grow it without bound.
export const draftVersions = {
  maxPerDoc: 50,
  drafts: {
    autosave: { interval: AUTOSAVE_INTERVAL },
    schedulePublish: false,
  },
} satisfies CollectionConfig['versions']

// The {page, label} pair the Header and Footer nav-link arrays both use.
export const navLinkFields: Field[] = [
  {
    name: 'page',
    type: 'relationship',
    relationTo: ['pages', 'posts', 'authors'],
    required: true,
  },
  {
    name: 'label',
    type: 'text',
    required: true,
    localized: true,
  },
]

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
