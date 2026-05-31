import type { Locale } from './shared'

// The locales this project ships. Single source of truth for both apps.
// Kept as readonly Locale[] (not `as const`) so LOCALE_URL_PREFIX below is a
// plain boolean and neither the single- nor multi-locale branch is typed as
// dead code.
export const LOCALES: readonly Locale[] = ['de', 'en']

export const DEFAULT_LOCALE: Locale = 'en'

// Admin labels keyed by locale code; a code with no entry falls back to the
// code itself. Typed by string, not Locale, so it can keep labels for locales
// a single-locale project no longer ships without tripping the type checker.
export const LOCALE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
}

// Build-time site display name, used for admin chrome such as the panel title.
// The public site renders the editable siteSettings.siteName instead.
export const SITE_NAME = 'Astroload'

// Multi-locale keeps the /{lang} URL prefix; single-locale drops it.
export const LOCALE_URL_PREFIX: boolean = LOCALES.length > 1

// DEFAULT_LOCALE must be one of LOCALES. Payload's defaultLocale, the URL-prefix
// stripping, and the public page lookup all anchor on it, so a value outside the
// shipped set would silently produce wrong paths. Fail fast at import instead.
if (!LOCALES.includes(DEFAULT_LOCALE)) {
  throw new Error(`DEFAULT_LOCALE "${DEFAULT_LOCALE}" must be one of LOCALES [${LOCALES.join(', ')}]`)
}
