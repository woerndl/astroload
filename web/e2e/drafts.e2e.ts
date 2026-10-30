import { DEFAULT_LOCALE, LOCALES } from '@astroload/cms/src/site-config.ts'

import { expect, previewKey, readKey, test } from './fixtures'

// The seed publishes /<default locale>/untranslated, saves an unpublished edit
// titled "Unpublished edit" and an unpublished translation with this title and
// the slug unpublished-translation in the next locale.
const other = LOCALES.find((code) => code !== DEFAULT_LOCALE)
const DRAFT = 'Unpublished translation'

test('a page with a published child can be neither unpublished nor deleted', async ({
  admin,
  cleanup,
}) => {
  const publish = async (data: Record<string, unknown>) => {
    const res = await admin.post(`/api/pages?locale=${DEFAULT_LOCALE}`, {
      data: { ...data, _status: 'published' },
    })
    await expect(res).toBeOK()
    const { id } = (await res.json()).doc
    cleanup(() => admin.delete(`/api/pages/${id}`))
    return id
  }
  const parent = await publish({ title: 'E2E parent', slug: 'e2e-parent' })
  await publish({ title: 'E2E child', slug: 'e2e-child', parent })
  const unpublish = await admin.patch(`/api/pages/${parent}?locale=${DEFAULT_LOCALE}`, {
    data: { _status: 'draft' },
  })
  expect(unpublish.status()).toBe(400)
  expect((await admin.delete(`/api/pages/${parent}`)).status()).toBe(400)
})

test.describe('with a second locale', () => {
  test.skip(!other, 'the project has one locale')

  let id: string

  test.beforeAll(async ({ admin }) => {
    const res = await admin.get('/api/pages?where[slug][equals]=untranslated')
    await expect(res).toBeOK()
    id = (await res.json()).docs[0]?.id
    expect(id, 'no page has the slug untranslated. Reseed with SEED_FORCE=1').toBeTruthy()
  })

  test('the built site and its sitemaps leave out an unpublished edit and translation', async ({
    web,
  }) => {
    const page = await web.get(`/${DEFAULT_LOCALE}/untranslated`)
    await expect(page).toBeOK()
    const html = await page.text()
    expect(html).not.toContain('Unpublished edit')
    expect(html).not.toContain('unpublished-translation')
    expect((await web.get(`/${other}/unpublished-translation`)).status()).toBe(404)
    const own = await web.get(`/${DEFAULT_LOCALE}/sitemap.xml`)
    await expect(own).toBeOK()
    expect(await own.text()).toContain(`/${DEFAULT_LOCALE}/untranslated</loc>`)
    const translated = await web.get(`/${other}/sitemap.xml`)
    await expect(translated).toBeOK()
    expect((await own.text()) + (await translated.text())).not.toContain('unpublished-translation')
  })

  test('only the preview key reads the unpublished translation, and only panel users read version history', async ({
    cms,
    admin,
  }) => {
    // A draft read from the read-only key runs as a published read.
    const draft = await cms.get(`/api/pages/${id}?locale=${other}&draft=true`, { headers: readKey })
    await expect(draft).toBeOK()
    expect((await draft.json()).title).not.toBe(DRAFT)
    const path = `/api/page-by-path?path=/${other}/unpublished-translation&preview=true`
    expect((await cms.get(path, { headers: readKey })).status()).toBe(403)
    const preview = await cms.get(path, { headers: previewKey })
    await expect(preview).toBeOK()
    expect((await preview.json()).data.title).toBe(DRAFT)

    const versions = `/api/pages/versions?where[parent][equals]=${id}`
    for (const headers of [readKey, previewKey])
      expect((await cms.get(versions, { headers })).status()).toBe(403)
    const history = await admin.get(versions)
    await expect(history).toBeOK()
    expect((await history.json()).totalDocs).toBeGreaterThan(0)
  })

  test('page-by-path matches the full path, not only the slug', async ({ cms }) => {
    const path = `/api/page-by-path?path=/${DEFAULT_LOCALE}/untranslated/untranslated`
    expect((await cms.get(path, { headers: readKey })).status()).toBe(404)
  })
})
