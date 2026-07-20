import { DEFAULT_LOCALE, isLocale, type Locale } from './types'

export function pickLocale(pathname: string, headerValue: string | null): Locale {
  return localeFromPath(pathname) ?? localeFromHeader(headerValue) ?? DEFAULT_LOCALE
}

function localeFromPath(pathname: string): Locale | undefined {
  const segments = pathname.split('/').filter(Boolean)
  const candidate = segments[0] === 'preview' ? segments[1] : segments[0]
  return isLocale(candidate) ? candidate : undefined
}

function localeFromHeader(header: string | null): Locale | undefined {
  if (!header) return undefined
  const entries = header.split(',').map((part) => {
    const [tag, ...params] = part.trim().split(';')
    const q = params.reduce((acc, p) => {
      const match = p.trim().match(/^q=([0-9.]+)$/)
      return match ? parseFloat(match[1]) : acc
    }, 1)
    return { lang: tag.toLowerCase().split('-')[0], q }
  })
  entries.sort((a, b) => b.q - a.q)
  for (const { lang, q } of entries) {
    // q=0 means "not acceptable" (RFC 9110), not lowest preference.
    if (q > 0 && isLocale(lang)) return lang
  }
  return undefined
}
