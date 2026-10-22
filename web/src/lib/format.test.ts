import { describe, expect, it } from 'vitest'

import { formatDate, formatNumber } from './format'

describe('formatDate', () => {
  it('renders 00:30 Vienna time as the previous day in UTC', () => {
    expect(formatDate('2026-01-06T00:30:00+01:00', 'de')).toBe('5. Januar 2026')
    expect(formatDate('2026-01-06T00:30:00+01:00', 'en')).toBe('January 5, 2026')
  })

  it('passes options through and keeps the site time zone', () => {
    const numeric = { day: 'numeric', month: 'numeric', year: 'numeric' } as const
    expect(formatDate('2026-01-05T23:30:00Z', 'de', numeric)).toBe('5.1.2026')
    expect(formatDate('2026-01-05T23:30:00Z', 'en', numeric)).toBe('1/5/2026')
  })
})

describe('formatNumber', () => {
  it('groups digits per locale', () => {
    expect(formatNumber(1234.5, 'de')).toBe('1.234,5')
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5')
  })
})
