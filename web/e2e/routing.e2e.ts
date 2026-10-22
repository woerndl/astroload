import { env, expect, test } from './fixtures'

test('the root redirects to the negotiated locale without caching', async ({ web }) => {
  for (const [acceptLanguage, location] of [
    ['de', '/de'],
    ['fr', '/en'],
  ]) {
    const res = await web.get('/', { headers: { 'Accept-Language': acceptLanguage } })
    expect(res.status(), acceptLanguage).toBe(302)
    expect(res.headers(), acceptLanguage).toMatchObject({ location, 'cache-control': 'no-store' })
    expect(res.headers()['vary'], acceptLanguage).toContain('Accept-Language')
  }
})

test('the home page carries hreflang alternates and x-default', async ({ web }) => {
  const res = await web.get('/en')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain(`<link rel="alternate" hreflang="en" href="${env.websiteUrl}/en">`)
  expect(html).toContain(`<link rel="alternate" hreflang="de" href="${env.websiteUrl}/de">`)
  expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${env.websiteUrl}/en">`)
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
