import { env, expect, home, test } from './fixtures'

// The tests need UMAMI_WEBSITE_ID in the build. The relay test also needs
// UMAMI_HOST_URL set to a loopback URL, for example http://127.0.0.1:4323,
// when the web app starts.
const event = (website: string) => ({
  type: 'event',
  payload: { website, hostname: 'localhost', url: '/en', language: 'en-US', screen: '1280x800' },
})

test("POST /api/send relays an event for this site's website id with the User-Agent and client IP, and answers 413 for an oversized body and 403 for another website id", async ({
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

  const oversized = await web.post('/api/send', { data: { ...body, padding: 'x'.repeat(9_000) } })
  expect(oversized.status()).toBe(413)
  const forged = await web.post('/api/send', { data: event('someone-else') })
  expect(forged.status()).toBe(403)
  expect(umami.requests).toHaveLength(1)
})

const secret = encodeURIComponent(env.previewSecret)

for (const [referrer, expected] of [
  [`https://example.org/?previewSecret=${secret}`, 'https://example.org/'],
  [`/preview/en/e2e?previewSecret=${secret}&lang=en`, '/preview/en/e2e?lang=en'],
] as const) {
  test(`the preview secret reaches neither the pageview url nor the referrer ${expected}`, async ({
    page,
  }) => {
    test.skip(!env.umamiWebsiteId, 'UMAMI_WEBSITE_ID is unset in web/.env')
    // The stand-in tracker reports window.name as the referrer, because page.goto sends none.
    await page.route('**/u.js', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: "window.umami = { track: (fn) => fetch('/api/send', { method: 'POST', body: JSON.stringify(fn({ referrer: window.name })) }) }",
      }),
    )
    const sent: string[] = []
    await page.route('**/api/send', (route) => {
      sent.push(route.request().postData() ?? '')
      return route.fulfill({ body: 'ok' })
    })
    await page.addInitScript((value) => (window.name = value), referrer)
    await page.goto(`${env.websiteUrl}${home}?previewSecret=${secret}&utm_source=e2e`)
    await expect.poll(() => sent).toHaveLength(1)
    expect(sent[0]).not.toContain(secret)
    expect(JSON.parse(sent[0]!)).toEqual({ url: `${home}?utm_source=e2e`, referrer: expected })
  })
}
