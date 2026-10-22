import { INTL_LOCALE, TIME_ZONE } from '@astroload/cms/src/site-config'

const intlLocale = (lang: string) => INTL_LOCALE[lang] ?? lang

export const formatDate = (
  value: string | Date,
  lang: string,
  options: Omit<Intl.DateTimeFormatOptions, 'timeZone'> = { dateStyle: 'long' },
) =>
  new Intl.DateTimeFormat(intlLocale(lang), { ...options, timeZone: TIME_ZONE }).format(
    new Date(value),
  )

export const formatNumber = (value: number, lang: string, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(intlLocale(lang), options).format(value)
