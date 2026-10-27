import { expect, it, vi } from 'vitest'

// astro:env exists only in the Astro build.
vi.mock('astro:env/client', () => ({
  CMS_URL: 'https://cms.example.com',
  WEBSITE_URL: 'https://site.example.com',
}))

const { versionedMediaURL } = await import('./urls')

const updatedAt = '2026-06-29T10:00:00.000Z'
const v = Date.parse(updatedAt)

it.each([
  ['/media/a.webp', updatedAt, `https://cms.example.com/media/a.webp?v=${v}`],
  ['/media/a.webp?w=480', updatedAt, `https://cms.example.com/media/a.webp?w=480&v=${v}`],
  ['/media/a.webp', undefined, 'https://cms.example.com/media/a.webp'],
  ['/media/a.webp', 'not-a-date', 'https://cms.example.com/media/a.webp'],
])('versionedMediaURL(%s, %s) is %s', (path, date, expected) => {
  expect(versionedMediaURL(path, date)).toBe(expected)
})
