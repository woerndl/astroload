import { expect, it, vi } from 'vitest'

import { formatDate } from './format'

// A zone far from UTC, so a date formatted in UTC or in Europe shows the wrong day.
vi.mock('@astroload/cms/src/site-config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  TIME_ZONE: 'Pacific/Kiritimati',
}))

const numeric = { day: 'numeric', month: 'numeric', year: 'numeric' } as const

it.each([
  ['de', undefined, '6. Januar 2026'],
  ['en', undefined, 'January 6, 2026'],
  ['de', numeric, '6.1.2026'],
  ['en', numeric, '1/6/2026'],
] as const)('formatDate(%s) renders the date in the site time zone', (lang, options, expected) => {
  expect(formatDate('2026-01-05T12:00:00Z', lang, options)).toBe(expected)
})
