import { randomBytes } from 'node:crypto'

import { env, expect, login, previewKey, readKey, test } from './fixtures'

test('a request without a key gets 401 from the custom endpoints and 403 from /api/pages', async ({
  cms,
}) => {
  for (const path of [
    '/api/page-by-path?path=/en',
    '/api/static-paths',
    '/api/global-data?locale=en',
  ]) {
    expect((await cms.get(path)).status(), path).toBe(401)
  }
  expect((await cms.get('/api/pages')).status()).toBe(403)
})

test('neither API key can write content, forms, users or API keys', async ({ cms, admin }) => {
  const pages = await admin.get('/api/pages?limit=1')
  const keys = await admin.get('/api/api-keys?where[type][equals]=read-only')
  const [page, key] = [(await pages.json()).docs[0].id, (await keys.json()).docs[0].id]
  const writes = [
    ['POST', '/api/pages?locale=en', { title: 'E2E key write', slug: 'e2e-key-write' }],
    ['POST', '/api/forms', { title: 'E2E key write' }],
    ['POST', '/api/users', { email: 'e2e-key@example.com', password: 'e2e-key-1234' }],
    ['POST', '/api/api-keys', { name: 'E2E key write', type: 'preview' }],
    ['PATCH', `/api/pages/${page}?locale=en`, { title: 'E2E key edit' }],
    ['DELETE', `/api/pages/${page}`],
    ['PATCH', `/api/api-keys/${key}`, { type: 'preview' }],
  ] as const
  for (const headers of [readKey, previewKey]) {
    for (const [method, path, data] of writes) {
      const res = await cms.fetch(path, { method, headers, data })
      expect(res.status(), `${method} ${path}`).toBe(403)
    }
  }
})

test('an editor changes its own name but not its roles, and cannot change another user', async ({
  cms,
  admin,
  cleanup,
}) => {
  const editor = { email: `e2e-editor-${Date.now()}@example.com`, password: 'e2e-editor-1234' }
  const created = await admin.post('/api/users', {
    data: { ...editor, firstName: 'E2E', lastName: 'Editor', roles: ['editor'] },
  })
  await expect(created).toBeOK()
  const { doc: user } = await created.json()
  cleanup(() => admin.delete(`/api/users/${user.id}`))
  const headers = await login(editor.email, editor.password)
  // Payload drops a field the requester may not write and saves the rest.
  const own = await cms.patch(`/api/users/${user.id}`, {
    headers,
    data: { firstName: 'Renamed', roles: ['admin'] },
  })
  await expect(own).toBeOK()
  const stored = await admin.get(`/api/users/${user.id}`)
  expect(await stored.json()).toMatchObject({ firstName: 'Renamed', roles: ['editor'] })
  const me = await admin.get('/api/users/me')
  const other = await cms.patch(`/api/users/${(await me.json()).user.id}`, {
    headers,
    data: { firstName: 'E2E' },
  })
  expect(other.status()).toBe(403)
})

test('an API key document shows no key value after creation', async ({ admin, cleanup }) => {
  const created = await admin.post('/api/api-keys', {
    data: {
      name: 'E2E key',
      type: 'read-only',
      enableAPIKey: true,
      apiKey: randomBytes(32).toString('hex'),
    },
  })
  await expect(created).toBeOK()
  const { doc } = await created.json()
  cleanup(() => admin.delete(`/api/api-keys/${doc.id}`))
  expect(doc.apiKey).toBeUndefined()
  const stored = await (await admin.get(`/api/api-keys/${doc.id}`)).json()
  expect(stored.apiKey).toBeUndefined()
  expect(stored.hasAPIKey).toBe(true)
})

test('pages, the preview route and their scripts contain neither API key', async ({ web }) => {
  for (const path of [
    '/en',
    `/preview/en?previewSecret=${encodeURIComponent(env.previewSecret)}`,
  ]) {
    const page = await web.get(path)
    await expect(page).toBeOK()
    const html = await page.text()
    const scripts = [...html.matchAll(/src="(\/_astro\/[^"]+\.js)"/g)].map((match) => match[1]!)
    for (const url of [path, ...scripts]) {
      const res = await web.get(url)
      await expect(res).toBeOK()
      const body = await res.text()
      for (const key of [env.readKey, env.previewKey]) expect(body.includes(key), url).toBe(false)
    }
  }
})
