import type { Page } from '@playwright/test'

import { env, expect, test } from './fixtures'

// UMAMI_WEBSITE_ID is baked into the build, so a build runs either the first
// test or the three after it. The relay test also needs UMAMI_HOST_URL set to a
// loopback URL, for example http://127.0.0.1:4322, when the web app starts.
const event = (website: string) => ({
  type: 'event',
  payload: { website, hostname: 'localhost', url: '/en', language: 'en-US', screen: '1280x800' },
})

test('POST /api/send answers 204 when no website id is configured', async ({ web }) => {
  test.skip(Boolean(env.umamiWebsiteId), 'UMAMI_WEBSITE_ID is set in web/.env')
  const res = await web.post('/api/send', { data: event('any') })
  expect(res.status()).toBe(204)
})

test("POST /api/send relays an event for this site's website id with the User-Agent and client IP, and answers 403 for another website id", async ({
  web,
  receiver,
}) => {
  test.skip(!env.umamiWebsiteId, 'UMAMI_WEBSITE_ID is unset in web/.env')
  const umami = await receiver(env.umamiHostUrl || 'https://cloud.umami.is')
  const body = event(env.umamiWebsiteId)

  const relayed = await web.post('/api/send', {
    data: body,
    headers: { 'User-Agent': 'e2e-agent', 'X-Real-IP': '203.0.113.7' },
  })
  expect(relayed.status()).toBe(200)
  expect(await relayed.text()).toBe('ok')
  expect(umami.requests).toHaveLength(1)
  const sent = umami.requests[0]!
  expect(sent).toMatchObject({
    method: 'POST',
    url: `${umami.url.pathname.replace(/\/$/, '')}/api/send`,
  })
  expect(JSON.parse(sent.body)).toEqual(body)
  expect(sent.headers).toMatchObject({
    'user-agent': 'e2e-agent',
    'x-umami-client-ip': '203.0.113.7',
  })
  expect(sent.headers['x-real-ip']).toBeUndefined()

  const forged = await web.post('/api/send', { data: event('someone-else') })
  expect(forged.status()).toBe(403)
  expect(umami.requests).toHaveLength(1)
})

async function stubTracker(page: Page) {
  await page.route('**/u.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "window.umami = { track: (fn) => fetch('/api/send', { method: 'POST', body: fn({}).url }) }",
    }),
  )
  const sent: string[] = []
  await page.route('**/api/send', (route) => {
    sent.push(route.request().postData() ?? '')
    return route.fulfill({ body: 'ok' })
  })
  return sent
}

test('each document load sends one pageview, a prerendered page only when opened, and a back/forward cache restore one more', async ({
  page,
}) => {
  test.skip(!env.umamiWebsiteId, 'UMAMI_WEBSITE_ID is unset in web/.env')
  const sent = await stubTracker(page)
  // Only the first document acts as prerendered, because activate() stores a flag that the next document reads.
  await page.addInitScript(() => {
    let prerendering = !sessionStorage.getItem('e2e-active')
    Object.defineProperty(document, 'prerendering', { get: () => prerendering })
    Object.assign(window, {
      activate: () => {
        prerendering = false
        sessionStorage.setItem('e2e-active', '1')
        document.dispatchEvent(new Event('prerenderingchange'))
      },
    })
  })

  await page.goto(`${env.websiteUrl}/en`)
  const tag = page.locator('script[data-website-id]')
  await expect(tag).toHaveAttribute('data-auto-pageview', 'false')
  await expect(tag).not.toHaveAttribute('data-auto-track')
  await page.waitForLoadState('networkidle')
  expect(sent).toEqual([])
  await page.evaluate(() => (window as unknown as { activate: () => void }).activate())
  await expect.poll(() => sent).toEqual(['/en'])

  // Playwright's Chromium runs without the back/forward cache, so the test fires the restore event itself.
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  )
  await expect.poll(() => sent).toEqual(['/en', '/en'])

  const link = page.locator('header nav a').first()
  const href = (await link.getAttribute('href'))!
  await link.click()
  await page.waitForURL(`**${href}`)
  await page.waitForLoadState('networkidle')
  expect(sent).toEqual(['/en', '/en', href])
})

test('the preview secret reaches neither a pageview payload nor a referrer', async ({ page }) => {
  test.skip(!env.umamiWebsiteId, 'UMAMI_WEBSITE_ID is unset in web/.env')
  // page.goto sends no referrer, so the stand-in tracker reports window.name as
  // the referrer. The loop sets window.name before each navigation to /en, and
  // window.name keeps its value across a same-origin navigation.
  await page.route('**/u.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "window.umami = { track: (fn) => fetch('/api/send', { method: 'POST', body: JSON.stringify(fn({ website: 'site', title: 'Title', referrer: window.name })) }) }",
    }),
  )
  const payloads: Record<string, unknown>[] = []
  await page.route('**/api/send', (route) => {
    payloads.push(JSON.parse(route.request().postData() ?? '{}'))
    return route.fulfill({ body: 'ok' })
  })
  const secret = encodeURIComponent(env.previewSecret)

  const missing = await page.goto(
    `${env.websiteUrl}/preview/en/e2e-missing?previewSecret=${secret}`,
  )
  expect(missing?.status()).toBe(404)
  await expect(page.locator('script[data-website-id]')).toHaveCount(0)

  for (const referrer of [
    `/preview/en/e2e-missing?previewSecret=${secret}&lang=en`,
    `https://example.org/page?previewSecret=${secret}`,
  ]) {
    await page.evaluate((value) => (window.name = value), referrer)
    const res = await page.goto(`${env.websiteUrl}/en?previewSecret=${secret}&utm_source=e2e`)
    expect(res?.headers()['referrer-policy']).toBe('no-referrer')
    await page.waitForLoadState('networkidle')
  }
  expect(payloads).toEqual([
    {
      website: 'site',
      title: 'Title',
      url: '/en?utm_source=e2e',
      referrer: '/preview/en/e2e-missing?lang=en',
    },
    {
      website: 'site',
      title: 'Title',
      url: '/en?utm_source=e2e',
      referrer: 'https://example.org/page',
    },
  ])
})
