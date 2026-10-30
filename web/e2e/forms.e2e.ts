import type { APIRequestContext } from '@playwright/test'

import { DEFAULT_LOCALE } from '@astroload/cms/src/site-config.ts'

import { env, expect, login, previewKey, readKey, test } from './fixtures'

const fromSite = { Origin: env.websiteUrl }

const FIELDS = [
  { field: 'name', value: 'E2E' },
  { field: 'email', value: 'e2e@example.com' },
  { field: 'dataset', value: 'Hello from the e2e suite.' },
]

type Entry = { field: string; value: string }

const CONFIRMATION = 'E2E: thanks for the message.'

// The control named dataset replaces form.dataset, so a form script that reads
// its settings from the form element fails here.
const CONTACT_FORM = {
  title: 'E2E contact',
  submitButtonLabel: 'Send',
  confirmationType: 'message',
  confirmationMessage: {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: CONFIRMATION }] }],
    },
  },
  fields: [
    { blockType: 'text', name: 'name', label: 'Name', required: true },
    { blockType: 'email', name: 'email', label: 'Email', required: true },
    { blockType: 'textarea', name: 'dataset', label: 'Message', required: true },
  ],
}

async function createForm(admin: APIRequestContext, cleanup: (fn: () => Promise<unknown>) => void) {
  const res = await admin.post(`/api/forms?locale=${DEFAULT_LOCALE}`, { data: CONTACT_FORM })
  await expect(res).toBeOK()
  const id: string = (await res.json()).doc.id
  cleanup(() => admin.delete(`/api/forms/${id}`))
  return id
}

// The body the public form posts. The default render stamp is older than the
// spam guard's 1.5 s minimum.
const submission = (
  form: string,
  entries: Entry[] = FIELDS,
  { fax = '', stamp = String(Date.now() - 5_000) } = {},
) => ({
  form,
  submissionData: [
    ...entries,
    { field: 'fax', value: fax },
    { field: '_rendered_at', value: stamp },
  ],
})

test('a visitor submits a form in the browser, only panel users read the stored fields, and only an admin deletes them', async ({
  page,
  cms,
  admin,
  cleanup,
}) => {
  const formId = await createForm(admin, cleanup)
  const draftPage = await admin.post(`/api/pages?locale=${DEFAULT_LOCALE}&draft=true`, {
    data: {
      title: 'E2E form',
      slug: 'e2e-form',
      _status: 'draft',
      sections: [{ blockType: 'form', form: formId }],
    },
  })
  await expect(draftPage).toBeOK()
  const pageId = (await draftPage.json()).doc.id
  cleanup(() => admin.delete(`/api/pages/${pageId}`))
  // The preview route renders on demand, so the draft page needs no rebuild.
  const secret = encodeURIComponent(env.previewSecret)
  await page.goto(`${env.websiteUrl}/preview/${DEFAULT_LOCALE}/e2e-form?previewSecret=${secret}`)
  const confirmation = page.getByText(CONFIRMATION)
  await expect(confirmation).toBeHidden()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E')
  await page.getByRole('textbox', { name: 'Email' }).fill('e2e@example.com')
  await page.getByRole('textbox', { name: 'Message' }).fill('Hello from the e2e suite.')
  // The spam guard rejects a submission sent less than 1.5 s after the form script started.
  await page.waitForTimeout(1_600)
  const posted = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/form-submissions' && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Send' }).click()
  const created = await posted
  expect(created.status()).toBe(201)
  const url = `/api/form-submissions/${(await created.json()).doc.id}`
  cleanup(() => admin.delete(url))
  expect(created.headers()['access-control-allow-origin']).toBe(env.websiteUrl)
  await expect(confirmation).toBeVisible()
  await expect(page.locator('[data-confirmation]')).toBeFocused()
  await expect(page.locator('form[data-form-id]')).toBeHidden()

  const editor = { email: `e2e-editor-${Date.now()}@example.com`, password: 'e2e-editor-1234' }
  const user = await admin.post('/api/users', {
    data: { ...editor, firstName: 'E2E', lastName: 'Editor', roles: ['editor'] },
  })
  await expect(user).toBeOK()
  const userId = (await user.json()).doc.id
  cleanup(() => admin.delete(`/api/users/${userId}`))
  const editorHeaders = await login(editor.email, editor.password)

  const stored = await cms.get(url, { headers: editorHeaders })
  await expect(stored).toBeOK()
  const { submissionData } = await stored.json()
  expect(submissionData.map(({ field, value }: Entry) => ({ field, value }))).toEqual(FIELDS)
  for (const headers of [{}, readKey, previewKey]) {
    expect((await cms.get(url, { headers })).status()).toBe(403)
  }
  for (const headers of [editorHeaders, readKey, previewKey]) {
    expect((await cms.patch(url, { headers, data: { submissionData: [] } })).status()).toBe(403)
    expect((await cms.delete(url, { headers })).status()).toBe(403)
  }
})

test('the spam guard and the submission validator reject forged POSTs with 400', async ({
  cms,
  admin,
  cleanup,
}) => {
  const formId = await createForm(admin, cleanup)
  const created = await admin.post('/api/forms', {
    data: {
      title: 'E2E checkbox',
      confirmationType: 'redirect',
      redirect: { url: 'https://example.com' },
      fields: [{ blockType: 'checkbox', name: 'consent', label: 'Consent', required: true }],
    },
  })
  await expect(created).toBeOK()
  const { doc: checkboxForm } = await created.json()
  cleanup(() => admin.delete(`/api/forms/${checkboxForm.id}`))
  // Built per request, so the render stamps are fresh when each POST is sent.
  const forged = {
    'non-array submissionData': () => ({
      ...submission(formId),
      submissionData: { field: 'name', value: 'x' },
    }),
    'oversized value': () =>
      submission(formId, [...FIELDS.slice(0, 2), { field: 'dataset', value: 'x'.repeat(10_001) }]),
    'oversized field name': () =>
      submission(formId, [...FIELDS, { field: 'x'.repeat(10_001), value: 'x' }]),
    'more than 100 entries': () =>
      submission(formId, [
        ...FIELDS,
        ...Array.from({ length: 96 }, (_, i) => ({ field: `extra${i}`, value: 'x' })),
      ]),
    'filled honeypot': () => submission(formId, FIELDS, { fax: 'spam' }),
    'missing render stamp': () => ({ form: formId, submissionData: FIELDS }),
    'submitted too fast': () => submission(formId, FIELDS, { stamp: String(Date.now()) }),
    'missing required field': () => submission(formId, FIELDS.slice(0, 2)),
    'whitespace-only required field': () =>
      submission(formId, [{ field: 'name', value: ' ' }, ...FIELDS.slice(1)]),
    'unchecked required checkbox': () =>
      submission(checkboxForm.id, [{ field: 'consent', value: 'false' }]),
    'duplicate field name': () => submission(formId, [...FIELDS, FIELDS[0]!]),
    'numeric form id': () => ({ ...submission(formId), form: 12 }),
  }
  for (const [name, data] of Object.entries(forged)) {
    const res = await cms.post('/api/form-submissions', { headers: fromSite, data: data() })
    if (res.ok()) {
      const { doc } = (await res.json()) as { doc: { id: string } }
      cleanup(() => admin.delete(`/api/form-submissions/${doc.id}`))
    }
    expect(res.status(), name).toBe(400)
    expect(await res.text(), name).toContain('Submission rejected.')
  }
  const formEncoded = await cms.post('/api/form-submissions', {
    headers: fromSite,
    form: { form: formId, name: 'x' },
  })
  expect(formEncoded.status(), 'form-encoded body').toBe(400)
  const primitive = await cms.post('/api/form-submissions', {
    headers: { ...fromSite, 'Content-Type': 'application/json' },
    data: '"x"',
  })
  expect(primitive.status(), 'primitive JSON body').toBe(400)
})

test('the CORS preflight allows the web app origin and no other origin', async ({ cms }) => {
  const preflight = (origin: string) =>
    cms.fetch('/api/form-submissions', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
  expect((await preflight(env.websiteUrl)).headers()['access-control-allow-origin']).toBe(
    env.websiteUrl,
  )
  expect(
    (await preflight('https://elsewhere.example')).headers()['access-control-allow-origin'],
  ).toBeUndefined()
})

test('form recipients stay hidden from anonymous and API key reads', async ({
  cms,
  admin,
  cleanup,
}) => {
  const recipient = 'e2e-recipient@example.com'
  const created = await admin.post('/api/forms', {
    data: {
      title: 'E2E recipients',
      confirmationType: 'redirect',
      redirect: { url: 'https://example.com' },
      fields: [{ blockType: 'text', name: 'name', label: 'Name' }],
      emails: [{ emailTo: recipient, subject: 'E2E' }],
    },
  })
  await expect(created).toBeOK()
  const { doc: form } = await created.json()
  cleanup(() => admin.delete(`/api/forms/${form.id}`))
  expect(await (await admin.get(`/api/forms/${form.id}`)).text()).toContain(recipient)
  for (const headers of [{}, readKey, previewKey]) {
    const res = await cms.get(`/api/forms/${form.id}`, { headers })
    await expect(res).toBeOK()
    expect(await res.text()).not.toContain(recipient)
  }
})

test('a form field named fax is refused with 400', async ({ admin }) => {
  const reserved = await admin.post('/api/forms', {
    data: { title: 'E2E reserved', fields: [{ blockType: 'text', name: 'fax', label: 'Fax' }] },
  })
  expect(reserved.status()).toBe(400)
  expect(await reserved.text()).toContain('reserved')
})

test('a form redirect to a javascript: URL is refused with 400', async ({ admin }) => {
  const res = await admin.post('/api/forms', {
    data: {
      title: 'E2E redirect',
      confirmationType: 'redirect',
      redirect: { url: 'javascript:alert(1)' },
      fields: [{ blockType: 'text', name: 'name', label: 'Name' }],
    },
  })
  expect(res.status()).toBe(400)
  expect(await res.text()).toContain('is not a path')
  const object = await admin.post('/api/forms', {
    data: {
      title: 'E2E redirect',
      confirmationType: 'redirect',
      redirect: { url: { _id: 'javascript:alert(1)' } },
      fields: [{ blockType: 'text', name: 'name', label: 'Name' }],
    },
  })
  expect(object.status()).toBe(400)
  expect(await object.text()).toContain('must be a text value')
})
