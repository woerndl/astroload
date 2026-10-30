import type { StaticPathItem } from '@astroload/cms/src/endpoints/staticPaths'

import { DEFAULT_LOCALE, LOCALES } from '@astroload/cms/src/site-config.ts'

import { env, expect, readKey, test } from './fixtures'

const other = LOCALES.find((code) => code !== DEFAULT_LOCALE)

test('the root redirects to a locale with a published home, without caching', async ({
  web,
  cms,
}) => {
  const paths = await cms.get('/api/static-paths', { headers: readKey })
  await expect(paths).toBeOK()
  const items: StaticPathItem[] = await paths.json()
  const homes = LOCALES.filter((code) => items.some((item) => item.paths[code] === `/${code}`))
  expect(homes.length).toBeGreaterThan(0)
  for (const [acceptLanguage, wanted] of [
    ['de', 'de'],
    ['fr', DEFAULT_LOCALE],
  ] as const) {
    const location = `/${homes.includes(wanted) ? wanted : homes[0]}`
    const res = await web.get('/', { headers: { 'Accept-Language': acceptLanguage } })
    expect(res.status(), acceptLanguage).toBe(302)
    expect(res.headers(), acceptLanguage).toMatchObject({ location, 'cache-control': 'no-store' })
    expect(res.headers()['vary'], acceptLanguage).toContain('Accept-Language')
  }
})

// The seed gives About both locales and publishes /<default locale>/untranslated
// in that locale only.
test('a page lists its translations as alternates and in the language switcher, and leaves out a missing one', async ({
  page,
  web,
  admin,
}) => {
  test.skip(!other, 'the project has one locale')
  const found = await admin.get('/api/pages?where[slug][equals]=untranslated')
  expect(
    (await found.json()).totalDocs,
    'no page has the slug untranslated. Reseed with SEED_FORCE=1',
  ).toBe(1)
  await page.goto(`${env.websiteUrl}/en/about`)
  const alternate = (code: string) => page.locator(`link[rel="alternate"][hreflang="${code}"]`)
  await expect(alternate('de')).toHaveAttribute('href', `${env.websiteUrl}/de/ueber-uns`)
  await expect(alternate('x-default')).toHaveAttribute('href', `${env.websiteUrl}/en/about`)
  await expect(page.locator('a[hreflang="de"]')).toHaveAttribute('href', '/de/ueber-uns')

  await page.goto(`${env.websiteUrl}/${DEFAULT_LOCALE}/untranslated`)
  await expect(alternate(other!)).toHaveCount(0)
  await expect(page.locator(`a[hreflang="${other}"]`)).toHaveAttribute('href', `/${other}`)
  expect((await web.get(`/${other}/untranslated`)).status()).toBe(404)
  expect(await (await web.get(`/${other}/sitemap.xml`)).text()).not.toContain('/untranslated<')
})

test('the /en page has a content-build-id meta tag with CONTENT_BUILD_ID when set and none when unset', async ({
  web,
}) => {
  const html = await (await web.get('/en')).text()
  const meta = html.match(/<meta name="content-build-id" content="([^"]*)">/)
  expect(
    meta?.[1],
    'CONTENT_BUILD_ID in web/.env differs from the value the build used. Rebuild the web app',
  ).toBe(env.contentBuildId || undefined)
})

test('a prerendered page and the preview route allow framing by the CMS origin only', async ({
  web,
}) => {
  const policy = `frame-ancestors ${new URL(env.cmsUrl).origin}`
  for (const path of [
    '/en',
    `/preview/en?previewSecret=${encodeURIComponent(env.previewSecret)}`,
  ]) {
    const res = await web.get(path)
    expect(res.status(), path).toBe(200)
    // With security.csp on, the preview route also carries Astro's policy in this header.
    expect(res.headers()['content-security-policy']?.split(/,\s*/), path).toContain(policy)
  }
})

test('Astro.url takes x-forwarded-host only for the WEBSITE_URL host', async ({ web }) => {
  // Astro's origin check compares Origin with the origin of Astro.url, so a
  // 403 shows that Astro.url did not take the forwarded host.
  const send = (host: string) =>
    web.post('/api/send', {
      headers: { 'Content-Type': 'text/plain', 'X-Forwarded-Host': host, Origin: `http://${host}` },
      data: '{}',
    })
  const listed = await send(new URL(env.websiteUrl).hostname)
  expect(await listed.text()).not.toContain('Cross-site')
  const unlisted = await send('unlisted.example.com')
  expect(unlisted.status()).toBe(403)
  expect(await unlisted.text()).toContain('Cross-site POST form submissions are forbidden')
})

test('an unknown path renders the localized 404 page with a 404 status', async ({ web }) => {
  const res = await web.get('/en/does-not-exist')
  expect(res.status()).toBe(404)
  expect(await res.text()).toMatch(/<h1[^>]*>Page not found<\/h1>/)
})

test('the sitemap index points at per-locale sitemaps with alternates', async ({ web }) => {
  const index = await web.get('/sitemap.xml')
  expect(index.status()).toBe(200)
  const indexXml = await index.text()
  expect(indexXml).toContain('<sitemapindex')
  for (const locale of ['en', 'de']) {
    expect(indexXml).toContain(`<loc>${env.websiteUrl}/${locale}/sitemap.xml</loc>`)
    const sitemap = await web.get(`/${locale}/sitemap.xml`)
    expect(sitemap.status(), locale).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain(`<loc>${env.websiteUrl}/${locale}</loc>`)
    expect(xml).toContain(`hreflang="x-default" href="${env.websiteUrl}/en"`)
  }
  expect((await web.get('/fr/sitemap.xml')).status()).toBe(404)
})
