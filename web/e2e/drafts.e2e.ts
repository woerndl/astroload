import { DEFAULT_LOCALE, LOCALES } from '@astroload/cms/src/site-config.ts'

import { expect, prefix, previewKey, readKey, test } from './fixtures'

// The seed publishes /<default locale>/untranslated with an unpublished edit,
// and with a second locale an unpublished translation at the slug
// unpublished-translation.
const other = LOCALES.find((code) => code !== DEFAULT_LOCALE)
const EDIT = 'Unpublished edit'
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

test.describe('the seeded page with unpublished changes', () => {
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
    const page = await web.get(`${prefix}/untranslated`)
    await expect(page).toBeOK()
    const html = await page.text()
    expect(html).not.toContain(EDIT)
    const own = await web.get(`${prefix}/sitemap.xml`)
    await expect(own).toBeOK()
    expect(await own.text()).toContain(`${prefix}/untranslated</loc>`)
    if (!other) return
    expect(html).not.toContain('unpublished-translation')
    expect((await web.get(`/${other}/unpublished-translation`)).status()).toBe(404)
    const translated = await web.get(`/${other}/sitemap.xml`)
    await expect(translated).toBeOK()
    expect((await own.text()) + (await translated.text())).not.toContain('unpublished-translation')
  })

  test('only the preview key reads the unpublished edit and translation, and only panel users read version history', async ({
    cms,
    admin,
  }) => {
    const drafts: [string, string, string][] = [[DEFAULT_LOCALE, 'untranslated', EDIT]]
    if (other) drafts.push([other, 'unpublished-translation', DRAFT])
    for (const [locale, slug, title] of drafts) {
      // A draft read from the read-only key runs as a published read.
      const draft = await cms.get(`/api/pages/${id}?locale=${locale}&draft=true`, {
        headers: readKey,
      })
      await expect(draft).toBeOK()
      expect((await draft.json()).title, locale).not.toBe(title)
      const path = `/api/page-by-path?path=/${locale}/${slug}&preview=true`
      expect((await cms.get(path, { headers: readKey })).status(), locale).toBe(403)
      const preview = await cms.get(path, { headers: previewKey })
      await expect(preview).toBeOK()
      expect((await preview.json()).data.title, locale).toBe(title)
    }

    const versions = `/api/pages/versions?where[parent][equals]=${id}`
    for (const headers of [readKey, previewKey])
      expect((await cms.get(versions, { headers })).status()).toBe(403)
    const history = await admin.get(versions)
    await expect(history).toBeOK()
    expect((await history.json()).totalDocs).toBeGreaterThan(0)
  })

  test('page-by-path matches the full path, not only the slug', async ({ cms }) => {
    const path = `/api/page-by-path?path=${prefix}/untranslated/untranslated`
    expect((await cms.get(path, { headers: readKey })).status()).toBe(404)
  })
})
