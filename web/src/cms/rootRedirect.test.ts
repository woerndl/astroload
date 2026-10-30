import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expect, it, vi } from 'vitest'

vi.mock('@astroload/cms/src/site-config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  LOCALES: ['de', 'en'],
  DEFAULT_LOCALE: 'en',
  LOCALE_URL_PREFIX: true,
}))
vi.mock('astro:env/client', () => ({ CMS_URL: 'https://cms.example.com' }))
vi.mock('./getStaticPaths', () => ({ getHomeLocales: async () => ['de'] }))

it('the root redirects a visitor whose locale has no home to a locale that has one', async () => {
  const { default: Index } = await import('../pages/index.astro')
  const container = await AstroContainer.create()
  const res = await container.renderToResponse(Index, {
    request: new Request('https://site.example.com/', { headers: { 'Accept-Language': 'en' } }),
  })
  expect(res.headers.get('location')).toBe('/de')
})
