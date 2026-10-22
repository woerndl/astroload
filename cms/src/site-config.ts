import type { Locale } from './shared'

// Used by both apps. Typed readonly Locale[] instead of `as const` so
// MULTIPLE_LOCALES below is a plain boolean and TypeScript does not treat
// the single-locale or the multi-locale branch as dead code.
export const LOCALES: readonly Locale[] = ['de', 'en']

export const DEFAULT_LOCALE: Locale = 'en'

// Admin labels by locale code. A code without an entry shows the code itself.
// Keyed by string so a project can keep labels for locales it dropped.
export const LOCALE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
}

// og:locale values by locale code, keyed by string like LOCALE_LABELS. A new
// locale needs an entry, because the territory does not follow from the
// language (en is en_US) and a missing entry omits the og:locale tag.
export const OG_LOCALE: Record<string, string> = {
  de: 'de_DE',
  en: 'en_US',
}

// BCP 47 locale for dates and numbers, keyed by locale code. Use the same
// region as OG_LOCALE. A missing entry uses the code itself.
export const INTL_LOCALE: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
}

// Time zone for rendered dates, independent of the build host's zone. A site
// whose readers share one zone sets it here, for example 'Europe/Vienna' with
// 'de-AT' in INTL_LOCALE and 'de_AT' in OG_LOCALE.
export const TIME_ZONE = 'UTC'

// Build-time site display name, used for admin chrome such as the panel title.
// The public site renders the editable siteSettings.siteName instead.
export const SITE_NAME = 'Astroload'

// Drives the language switcher and hreflang alternates. It is separate from
// URL prefixing so a single-locale project can keep the prefix without the
// switcher.
export const MULTIPLE_LOCALES: boolean = LOCALES.length > 1

// Set to true to keep the /{locale} prefix on a single-locale project that may
// add locales later, so its URLs do not change. null follows MULTIPLE_LOCALES.
// false with several locales throws below, because their un-prefixed URLs
// would collide.
const FORCE_URL_PREFIX: boolean | null = null

export const LOCALE_URL_PREFIX: boolean = FORCE_URL_PREFIX ?? MULTIPLE_LOCALES

if (!LOCALE_URL_PREFIX && MULTIPLE_LOCALES) {
  throw new Error(
    'URL prefixing cannot be off while more than one locale ships: un-prefixed multi-locale URLs would collide. Set FORCE_URL_PREFIX to true or leave it null.',
  )
}

// Payload's defaultLocale, the prefix stripping, and the public page lookup all
// use DEFAULT_LOCALE, so a value outside LOCALES would produce wrong paths.
if (!LOCALES.includes(DEFAULT_LOCALE)) {
  throw new Error(
    `DEFAULT_LOCALE "${DEFAULT_LOCALE}" must be one of LOCALES [${LOCALES.join(', ')}]`,
  )
}
