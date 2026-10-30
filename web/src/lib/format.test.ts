import { expect, it, vi } from 'vitest'

import { formatDate } from './format'

// A zone far from UTC, so a date formatted in UTC or in Europe shows the wrong day.
vi.mock('@astroload/cms/src/site-config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  TIME_ZONE: 'Pacific/Kiritimati',
  INTL_LOCALE: { en: 'en-US' },
}))

it('formatDate renders the date in the site time zone', () => {
  expect(formatDate('2026-01-05T12:00:00Z', 'en')).toBe('January 6, 2026')
})
