import type { CollectionConfig, Field } from 'payload'

import type { Config } from './payload-types'
import { LOCALES } from './site-config'

export type Locale = Config['locale']

export { LOCALES, DEFAULT_LOCALE, LOCALE_URL_PREFIX } from './site-config'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

// Allowed rich-text link schemes, used by the CMS validator
// (cms/src/lexical/editor.ts) and the web sanitizer
// (web/src/components/lexical/sanitizeLinks.ts). The sanitizer catches links
// that skip the validator, such as imports, seeds, and autosaved drafts.
export const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

export const pageCollectionsSlugs = ['pages', 'posts', 'authors'] as const

export type PageCollectionSlug = (typeof pageCollectionsSlugs)[number]

// Templates whose body is a component in
// web/src/layout/routes/TemplatedBody.astro instead of the sections blocks.
// Each has one Pages document, which seedTemplatedPage() writes with a fixed
// slug, parent and root state. Example: ['home'].
export const pageTemplates = [] as const satisfies readonly string[]

export type PageTemplate = (typeof pageTemplates)[number]

// Admin labels for the template select, one entry per template.
export const pageTemplateLabels: Record<'default' | PageTemplate, Record<string, string>> = {
  default: { en: 'Standard page', de: 'Standardseite' },
}

export type LocalePaths = Partial<Record<Locale, string>>

const AUTOSAVE_INTERVAL = 1500

// date-fns patterns for the admin. admin.dateFormat in payload.config.ts
// formats list columns of date fields without their own displayFormat, such
// as createdAt and updatedAt. The date picker reads only its field's
// displayFormat, so set admin.date on every date field to dateTimeField or
// dateOnlyField, or spread one into the field's own admin.date. For another
// format, change these two constants and timeFormat below.
export const DATE_FORMAT = 'dd.MM.yyyy HH:mm'
export const DATE_ONLY_FORMAT = 'dd.MM.yyyy'

// timeFormat sets the picker's time list, which defaults to 'h:mm aa'.
export const dateTimeField = {
  pickerAppearance: 'dayAndTime',
  displayFormat: DATE_FORMAT,
  timeFormat: 'HH:mm',
} as const

export const dateOnlyField = {
  pickerAppearance: 'dayOnly',
  displayFormat: DATE_ONLY_FORMAT,
} as const

// maxPerDoc caps the version history, which autosave would otherwise grow
// without limit.
export const draftVersions = {
  maxPerDoc: 50,
  drafts: {
    autosave: { interval: AUTOSAVE_INTERVAL },
    schedulePublish: false,
  },
} satisfies CollectionConfig['versions']

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

// Pages, Posts, and Authors use Payload's default group.
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
