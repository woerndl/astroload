import type { Locale } from './shared'

// The locales this project ships. Single source of truth for both apps.
// Kept as readonly Locale[] (not `as const`) so LOCALE_URL_PREFIX below is a
// plain boolean and neither the single- nor multi-locale branch is typed as
// dead code.
export const LOCALES: readonly Locale[] = ['de', 'en']

export const DEFAULT_LOCALE: Locale = 'en'

// Admin labels per locale; a missing code falls back to the code itself.
export const LOCALE_LABELS: Partial<Record<Locale, string>> = {
  de: 'Deutsch',
  en: 'English',
}

// Build-time site display name, used for admin chrome such as the panel title.
// The public site renders the editable siteSettings.siteName instead.
export const SITE_NAME = 'Astroload'

// Multi-locale keeps the /{lang} URL prefix; single-locale drops it.
export const LOCALE_URL_PREFIX: boolean = LOCALES.length > 1
