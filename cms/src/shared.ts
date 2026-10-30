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

export const pageCollectionsSlugs = ['pages', 'posts'] as const

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

// date-fns patterns. The date picker ignores admin.dateFormat (payload.config.ts)
// and reads only its field's displayFormat, so every date field sets admin.date
// to dateTimeField or spreads it into its own admin.date.
export const DATE_FORMAT = 'dd.MM.yyyy HH:mm'

// timeFormat sets the picker's time list, which defaults to 'h:mm aa'.
export const dateTimeField = {
  pickerAppearance: 'dayAndTime',
  displayFormat: DATE_FORMAT,
  timeFormat: 'HH:mm',
} as const

export const draftVersions = {
  drafts: {
    autosave: { interval: AUTOSAVE_INTERVAL },
    schedulePublish: false,
  },
} satisfies CollectionConfig['versions']

export const navLinkFields: Field[] = [
  {
    name: 'page',
    type: 'relationship',
    relationTo: ['pages', 'posts'],
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
