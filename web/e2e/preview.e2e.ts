import { ADMIN, env, expect, json, test } from './fixtures'

const TITLE = 'E2E live preview'
const EDITED = 'E2E live preview edited'

test('the preview route answers 403 without the right secret, and every response sends no-store, noindex and no-referrer headers', async ({
  web,
}) => {
  const secret = `previewSecret=${encodeURIComponent(env.previewSecret)}`
  const cases = [
    ['/preview/en', 403],
    ['/preview/en?previewSecret=wrong', 403],
    [`/preview/en?${secret}`, 200],
    [`/preview/xx?${secret}`, 404],
    [`/preview/en/e2e-does-not-exist?${secret}`, 404],
  ] as const
  for (const [path, status] of cases) {
    const res = await web.get(path)
    expect(res.status(), path).toBe(status)
    expect(res.headers(), path).toMatchObject({
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    })
    expect(res.headers()['x-robots-tag'], path).toContain('noindex')
  }
})

test('live preview loads the preview route in the admin iframe and shows the edited title after an autosave', async ({
  page,
  admin,
  create,
  cleanup,
}) => {
  const doc = await create<{ id: string }>('pages?locale=en&draft=true', {
    data: { title: TITLE, slug: 'e2e-live-preview', _status: 'draft' },
  })

  // Payload stores the live preview toggle per user in payload-preferences, so
  // setting it here opens the edit view with the preview iframe.
  const prefPath = '/api/payload-preferences/collection-pages'
  const previous = await admin.get(prefPath)
  const previousValue = previous.ok()
    ? ((await previous.json()) as { value: Record<string, unknown> }).value
    : undefined
  cleanup(() =>
    previousValue
      ? admin.post(prefPath, { data: { value: previousValue } })
      : admin.delete(prefPath),
  )
  await json(
    await admin.post(prefPath, {
      data: { value: { ...previousValue, editViewType: 'live-preview' } },
    }),
  )

  await page.goto(`${env.cmsUrl}/admin/login`)
  await page.locator('#field-email').fill(ADMIN.email)
  await page.locator('#field-password').fill(ADMIN.password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/admin(?!\/login)/)

  await page.goto(`${env.cmsUrl}/admin/collections/pages/${doc.id}`)
  const iframe = page.locator('iframe[src*="/preview/"]')
  await expect(iframe).toHaveAttribute(
    'src',
    new RegExp(`^${env.websiteUrl}/preview/en/e2e-live-preview\\?previewSecret=`),
  )
  const frame = page.frameLocator('iframe[src*="/preview/"]')
  await expect(frame.locator('h1')).toHaveText(TITLE)
  // When the preview page reports ready, the admin posts a document event and
  // the page reloads. Waiting for network idle lets those reloads finish.
  await page.waitForLoadState('networkidle')

  await page.locator('#field-title').fill(EDITED)
  await expect(frame.locator('h1')).toHaveText(EDITED, { timeout: 20_000 })
})
