import { expect, json, previewKey, readKey, test } from './fixtures'

const PUBLISHED = 'E2E published title'
const DRAFT = 'E2E draft title'

let pageId: string | undefined

test.beforeAll(async ({ admin }) => {
  const created = await admin.post('/api/pages?locale=en', {
    data: { title: PUBLISHED, slug: 'e2e-drafts', _status: 'published' },
  })
  pageId = (await json<{ doc: { id: string } }>(created, 201)).doc.id
  await json(
    await admin.patch(`/api/pages/${pageId}?locale=en&draft=true`, {
      data: { title: DRAFT, _status: 'draft' },
    }),
  )
})

test.afterAll(async ({ admin }) => {
  if (pageId) await admin.delete(`/api/pages/${pageId}`)
})

test('the read-only key gets the published version and not the draft', async ({ cms }) => {
  const doc = await json<{ title: string }>(
    await cms.get(`/api/pages/${pageId}?locale=en`, { headers: readKey }),
  )
  expect(doc.title).toBe(PUBLISHED)
  // Payload answers 404 when the access filter excludes the latest draft.
  expect(
    (await cms.get(`/api/pages/${pageId}?locale=en&draft=true`, { headers: readKey })).status(),
  ).toBe(404)
  const byPath = await json<{ data: { title: string } }>(
    await cms.get('/api/page-by-path?path=/en/e2e-drafts', { headers: readKey }),
  )
  expect(byPath.data.title).toBe(PUBLISHED)
})

test('the preview key gets the draft', async ({ cms }) => {
  const doc = await json<{ title: string }>(
    await cms.get(`/api/pages/${pageId}?locale=en&draft=true`, { headers: previewKey }),
  )
  expect(doc.title).toBe(DRAFT)
  const byPath = await json<{ data: { title: string } }>(
    await cms.get('/api/page-by-path?path=/en/e2e-drafts&preview=true', { headers: previewKey }),
  )
  expect(byPath.data.title).toBe(DRAFT)
})

test('the read-only key is refused preview reads, and only panel users read version history', async ({
  cms,
  admin,
}) => {
  expect(
    (
      await cms.get('/api/page-by-path?path=/en/e2e-drafts&preview=true', { headers: readKey })
    ).status(),
  ).toBe(403)
  const versions = `/api/pages/versions?where[parent][equals]=${pageId}`
  for (const headers of [readKey, previewKey])
    expect((await cms.get(versions, { headers })).status()).toBe(403)
  expect((await json<{ totalDocs: number }>(await admin.get(versions))).totalDocs).toBeGreaterThan(
    0,
  )
})
