import { randomBytes } from 'node:crypto'

import { env, expect, json, login, previewKey, readKey, test } from './fixtures'

test('the read-only key reads published content only', async ({ cms }) => {
  const { docs } = await json<{ docs: { _status: string }[] }>(
    await cms.get('/api/pages?locale=en&limit=100', { headers: readKey }),
  )
  expect(docs.length).toBeGreaterThan(0)
  expect(docs.every((doc) => doc._status === 'published')).toBe(true)
})

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

test('neither API key can write content, forms, users or API keys', async ({ cms, create }) => {
  const page = await create<{ id: string }>('pages?locale=en&draft=true', {
    data: { title: 'E2E key target', slug: 'e2e-key-target', _status: 'draft' },
  })
  for (const headers of [readKey, previewKey]) {
    const creates = {
      '/api/pages?locale=en': { title: 'E2E key write', slug: 'e2e-key-write' },
      '/api/forms': { title: 'E2E key write' },
      '/api/users': {
        email: 'e2e-key-write@example.com',
        password: 'e2e-key-1234',
        firstName: 'E',
        lastName: 'K',
        roles: ['admin'],
      },
      '/api/api-keys': { name: 'E2E key write', type: 'preview' },
    }
    for (const [path, data] of Object.entries(creates)) {
      expect((await cms.post(path, { headers, data })).status(), `POST ${path}`).toBe(403)
    }
    expect(
      (
        await cms.patch(`/api/pages/${page.id}?locale=en`, {
          headers,
          data: { title: 'E2E key edit' },
        })
      ).status(),
    ).toBe(403)
    expect((await cms.delete(`/api/pages/${page.id}`, { headers })).status()).toBe(403)
  }
})

test('an editor cannot change its own roles', async ({ cms, admin, create }) => {
  const editor = { email: `e2e-editor-${Date.now()}@example.com`, password: 'e2e-editor-1234' }
  const user = await create<{ id: string }>('users', {
    data: { ...editor, firstName: 'E2E', lastName: 'Editor', roles: ['editor'] },
  })
  // Payload drops a field the requester may not write and still answers 200.
  await cms.patch(`/api/users/${user.id}`, {
    headers: await login(editor.email, editor.password),
    data: { roles: ['admin'] },
  })
  expect((await json<{ roles: string[] }>(await admin.get(`/api/users/${user.id}`))).roles).toEqual(
    ['editor'],
  )
})

test('an API key document shows no key value after creation', async ({ admin, create }) => {
  const doc = await create<{ id: string; apiKey?: string }>('api-keys', {
    data: {
      name: 'E2E key',
      type: 'read-only',
      enableAPIKey: true,
      apiKey: randomBytes(32).toString('hex'),
    },
  })
  expect(doc.apiKey).toBeUndefined()
  const stored = await json<{ apiKey?: string; hasAPIKey?: boolean }>(
    await admin.get(`/api/api-keys/${doc.id}`),
  )
  expect(stored.apiKey).toBeUndefined()
  expect(stored.hasAPIKey).toBe(true)
})

test('pages, the preview route and their scripts contain neither API key', async ({ web }) => {
  for (const path of [
    '/en',
    `/preview/en?previewSecret=${encodeURIComponent(env.previewSecret)}`,
  ]) {
    const html = await (await web.get(path)).text()
    const scripts = [...html.matchAll(/src="(\/_astro\/[^"]+\.js)"/g)].map((match) => match[1]!)
    for (const body of [
      html,
      ...(await Promise.all(scripts.map(async (src) => (await web.get(src)).text()))),
    ]) {
      for (const key of [env.readKey, env.previewKey]) expect(body.includes(key), path).toBe(false)
    }
  }
})
