import type { Locale } from './shared'

// The locale list used by both apps.
// Kept as readonly Locale[] (not `as const`) so MULTIPLE_LOCALES below derives a
// plain boolean and neither the single- nor multi-locale branch is typed as
// dead code.
export const LOCALES: readonly Locale[] = ['de', 'en']

export const DEFAULT_LOCALE: Locale = 'en'

// Admin labels keyed by locale code. A code with no entry falls back to the
// code itself. Typed by string, not Locale, so it can keep labels for locales
// a single-locale project no longer ships without tripping the type checker.
export const LOCALE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
}

// og:locale values keyed by locale code, same string typing as LOCALE_LABELS.
// A locale missing here omits the og:locale tag: the territory half cannot be
// derived from the language (en maps to en_US, not en_EN), so a new locale
// needs an entry.
export const OG_LOCALE: Record<string, string> = {
  de: 'de_DE',
  en: 'en_US',
}

// Build-time site display name, used for admin chrome such as the panel title.
// The public site renders the editable siteSettings.siteName instead.
export const SITE_NAME = 'Astroload'

// Drives the multilingual UI (language switcher, hreflang alternates). Kept
// separate from URL prefixing so a single-locale project can force the prefix
// without also turning the switcher on.
export const MULTIPLE_LOCALES: boolean = LOCALES.length > 1

// Set to true to keep the /{locale} prefix on a project that ships one locale
// today but may add more later, so its URLs survive that change with no
// redirects. When left null, prefixing follows MULTIPLE_LOCALES. Forcing it
// false while several locales ship is rejected below, since their un-prefixed
// URLs would collide.
const FORCE_URL_PREFIX: boolean | null = null

export const LOCALE_URL_PREFIX: boolean = FORCE_URL_PREFIX ?? MULTIPLE_LOCALES

if (!LOCALE_URL_PREFIX && MULTIPLE_LOCALES) {
  throw new Error(
    'URL prefixing cannot be off while more than one locale ships: un-prefixed multi-locale URLs would collide. Set FORCE_URL_PREFIX to true or leave it null.',
  )
}

// DEFAULT_LOCALE must be one of LOCALES. Payload's defaultLocale, the URL-prefix
// stripping, and the public page lookup all anchor on it, so a value outside the
// shipped set would silently produce wrong paths. Throw during import instead.
if (!LOCALES.includes(DEFAULT_LOCALE)) {
  throw new Error(`DEFAULT_LOCALE "${DEFAULT_LOCALE}" must be one of LOCALES [${LOCALES.join(', ')}]`)
}
