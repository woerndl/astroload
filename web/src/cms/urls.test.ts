import { describe, expect, it, vi } from 'vitest'

// urls.ts reads CMS_URL from the astro:env virtual module, which only exists in
// the Astro build. Stub it so the helper can be exercised in isolation.
vi.mock('astro:env/client', () => ({
  CMS_URL: 'https://cms.example.com',
  WEBSITE_URL: 'https://site.example.com',
}))

const { versionedMediaURL } = await import('./urls')

describe('versionedMediaURL', () => {
  it('appends ?v with the updatedAt timestamp', () => {
    expect(versionedMediaURL('/media/a.webp', '2026-06-29T10:00:00.000Z')).toBe(
      `https://cms.example.com/media/a.webp?v=${Date.parse('2026-06-29T10:00:00.000Z')}`,
    )
  })

  it('omits the marker when updatedAt is missing or unparseable', () => {
    expect(versionedMediaURL('/media/a.webp')).toBe('https://cms.example.com/media/a.webp')
    expect(versionedMediaURL('/media/a.webp', 'not-a-date')).toBe(
      'https://cms.example.com/media/a.webp',
    )
  })

  it('keeps an existing query string instead of corrupting it', () => {
    expect(versionedMediaURL('/media/a.webp?w=480', '2026-06-29T10:00:00.000Z')).toBe(
      `https://cms.example.com/media/a.webp?w=480&v=${Date.parse('2026-06-29T10:00:00.000Z')}`,
    )
  })
})
