import type { APIRequestContext } from '@playwright/test'
import type { StaticPathItem } from '@astroload/cms/src/endpoints/staticPaths'

import { DEFAULT_LOCALE, LOCALE_URL_PREFIX, LOCALES } from '@astroload/cms/src/site-config.ts'

import { env, expect, home, prefix, readKey, test } from './fixtures'

const other = LOCALES.find((code) => code !== DEFAULT_LOCALE)

async function staticPaths(cms: APIRequestContext): Promise<StaticPathItem[]> {
  const res = await cms.get('/api/static-paths', { headers: readKey })
  await expect(res).toBeOK()
  return res.json()
}

test('the root redirects to a locale with a published home, without caching', async ({
  web,
  cms,
}) => {
  test.skip(!LOCALE_URL_PREFIX, 'the root renders the home page')
  const items = await staticPaths(cms)
  const homes = LOCALES.filter((code) => items.some((item) => item.paths[code] === `/${code}`))
  expect(homes.length).toBeGreaterThan(0)
  for (const [acceptLanguage, wanted] of [
    ...LOCALES.map((code) => [code, code] as const),
    ['xx', DEFAULT_LOCALE] as const,
  ]) {
    const location = `/${homes.includes(wanted) ? wanted : homes[0]}`
    const res = await web.get('/', { headers: { 'Accept-Language': acceptLanguage } })
    expect(res.status(), acceptLanguage).toBe(302)
    expect(res.headers(), acceptLanguage).toMatchObject({ location, 'cache-control': 'no-store' })
    expect(res.headers()['vary'], acceptLanguage).toContain('Accept-Language')
  }
})

// The seed publishes /<default locale>/untranslated in that locale only.
test('a page lists its translations as alternates and in the language switcher, and leaves out a missing one', async ({
  page,
  web,
  cms,
  admin,
}) => {
  test.skip(!other, 'the project has one locale')
  const found = await admin.get('/api/pages?where[slug][equals]=untranslated')
  expect(
    (await found.json()).totalDocs,
    'no page has the slug untranslated. Reseed with SEED_FORCE=1',
  ).toBe(1)
  // Equal slugs in both locales would hide a switcher that only swaps the locale prefix.
  const withoutLocale = (path = '') => path.replace(/^\/[^/]+/, '')
  const translated = (await staticPaths(cms)).find(
    ({ paths }) =>
      paths[DEFAULT_LOCALE] &&
      paths[other!] &&
      withoutLocale(paths[DEFAULT_LOCALE]) !== withoutLocale(paths[other!]),
  )
  expect(
    translated,
    'the test needs a published page with a different slug in each locale',
  ).toBeDefined()
  const { [DEFAULT_LOCALE]: own, [other!]: translation } = translated!.paths
  await page.goto(`${env.websiteUrl}${own}`)
  const alternate = (code: string) => page.locator(`link[rel="alternate"][hreflang="${code}"]`)
  await expect(alternate(other!)).toHaveAttribute('href', `${env.websiteUrl}${translation}`)
  await expect(alternate('x-default')).toHaveAttribute('href', `${env.websiteUrl}${own}`)
  await expect(page.locator(`a[hreflang="${other}"]`)).toHaveAttribute('href', translation!)

  await page.goto(`${env.websiteUrl}/${DEFAULT_LOCALE}/untranslated`)
  await expect(alternate(other!)).toHaveCount(0)
  await expect(page.locator(`a[hreflang="${other}"]`)).toHaveAttribute('href', `/${other}`)
  expect((await web.get(`/${other}/untranslated`)).status()).toBe(404)
  expect(await (await web.get(`/${other}/sitemap.xml`)).text()).not.toContain('/untranslated<')
})

test('the home page has a content-build-id meta tag with CONTENT_BUILD_ID when set and none when unset', async ({
  web,
}) => {
  const html = await (await web.get(home)).text()
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
    home,
    `/preview/${DEFAULT_LOCALE}?previewSecret=${encodeURIComponent(env.previewSecret)}`,
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

test('an unknown path renders the 404 page with the title from the labels global and a 404 status', async ({
  page,
  cms,
}) => {
  const labels = await cms.get(`/api/globals/labels?locale=${DEFAULT_LOCALE}`, { headers: readKey })
  await expect(labels).toBeOK()
  const res = await page.goto(`${env.websiteUrl}${prefix}/does-not-exist`)
  expect(res?.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText((await labels.json()).notFound.title)
})

test('the sitemap lists every published path, and with locale prefixes an index points at a sitemap per locale with alternates', async ({
  web,
  cms,
}) => {
  const items = await staticPaths(cms)
  const sitemaps = LOCALE_URL_PREFIX
    ? LOCALES.map((locale) => [locale, `/${locale}/sitemap.xml`] as const)
    : [[DEFAULT_LOCALE, '/sitemap.xml'] as const]
  if (LOCALE_URL_PREFIX) {
    const index = await web.get('/sitemap.xml')
    expect(index.status()).toBe(200)
    const indexXml = await index.text()
    for (const [, path] of sitemaps) {
      expect(indexXml).toContain(`<loc>${new URL(path, env.websiteUrl)}</loc>`)
    }
  }
  for (const [locale, path] of sitemaps) {
    const sitemap = await web.get(path)
    expect(sitemap.status(), path).toBe(200)
    const xml = await sitemap.text()
    for (const item of items) {
      const own = item.paths[locale]
      if (!own) continue
      expect(xml, path).toContain(`<loc>${new URL(own, env.websiteUrl)}</loc>`)
      const xDefault = item.paths[DEFAULT_LOCALE]
      if (other && xDefault) {
        expect(xml, path).toContain(
          `hreflang="x-default" href="${new URL(xDefault, env.websiteUrl)}"`,
        )
      }
    }
  }
  const unknown = LOCALE_URL_PREFIX ? 'xx' : DEFAULT_LOCALE
  expect((await web.get(`/${unknown}/sitemap.xml`)).status()).toBe(404)
})
