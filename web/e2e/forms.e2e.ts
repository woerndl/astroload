import { env, expect, json, login, previewKey, readKey, test } from './fixtures'

const fromSite = { Origin: env.websiteUrl }

const FIELDS = [
  { field: 'name', value: 'E2E' },
  { field: 'email', value: 'e2e@example.com' },
  { field: 'message', value: 'Hello from the e2e suite.' },
]

type Entry = { field: string; value: string }

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

let formId: string

test.beforeAll(async ({ cms }) => {
  const { docs } = await json<{ docs: { id: string }[] }>(
    await cms.get('/api/forms?where[title][equals]=Contact&limit=1'),
  )
  expect(docs, 'the seeded Contact form').toHaveLength(1)
  formId = docs[0]!.id
})

test('a cross-origin POST stores the visitor fields, only panel users read the submission, and only an admin deletes it', async ({
  cms,
  admin,
  create,
  cleanup,
}) => {
  const created = await cms.post('/api/form-submissions', {
    headers: fromSite,
    data: submission(formId),
  })
  const { doc } = await json<{ doc: { id: string } }>(created, 201)
  cleanup(async () =>
    expect(
      (await admin.delete(`/api/form-submissions/${doc.id}`)).status(),
      'admin deletes the submission',
    ).toBe(200),
  )
  expect(created.headers()['access-control-allow-origin']).toBe(env.websiteUrl)

  const editor = { email: `e2e-editor-${Date.now()}@example.com`, password: 'e2e-editor-1234' }
  await create('users', {
    data: { ...editor, firstName: 'E2E', lastName: 'Editor', roles: ['editor'] },
  })
  const editorHeaders = await login(editor.email, editor.password)

  const stored = await json<{ submissionData: Entry[] }>(
    await cms.get(`/api/form-submissions/${doc.id}`, { headers: editorHeaders }),
  )
  expect(stored.submissionData.map(({ field, value }) => ({ field, value }))).toEqual(FIELDS)
  for (const headers of [{}, readKey, previewKey]) {
    expect((await cms.get(`/api/form-submissions/${doc.id}`, { headers })).status()).toBe(403)
  }
  for (const headers of [editorHeaders, readKey, previewKey]) {
    expect(
      (
        await cms.patch(`/api/form-submissions/${doc.id}`, {
          headers,
          data: { submissionData: [] },
        })
      ).status(),
    ).toBe(403)
    expect((await cms.delete(`/api/form-submissions/${doc.id}`, { headers })).status()).toBe(403)
  }
})

test('the spam guard and the submission validator reject forged POSTs with 400', async ({
  cms,
  admin,
  cleanup,
}) => {
  // Built per request, so the render stamps are fresh when each POST is sent.
  const forged = {
    'non-array submissionData': () => ({
      ...submission(formId),
      submissionData: { field: 'name', value: 'x' },
    }),
    'oversized value': () =>
      submission(formId, [...FIELDS.slice(0, 2), { field: 'message', value: 'x'.repeat(10_001) }]),
    'oversized field name': () =>
      submission(formId, [...FIELDS, { field: 'x'.repeat(10_001), value: 'x' }]),
    'more than 100 entries': () =>
      submission(formId, [
        ...FIELDS,
        ...Array.from({ length: 96 }, (_, i) => ({ field: `extra${i}`, value: 'x' })),
      ]),
    'filled honeypot': () => submission(formId, FIELDS, { fax: 'spam' }),
    'missing render stamp': () => submission(formId, FIELDS, { stamp: 'none' }),
    'submitted too fast': () => submission(formId, FIELDS, { stamp: String(Date.now()) }),
    'missing required field': () => submission(formId, FIELDS.slice(0, 2)),
    'duplicate field name': () => submission(formId, [...FIELDS, FIELDS[0]!]),
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

test('a visitor submits the contact form in the browser and sees the confirmation', async ({
  page,
  admin,
  cleanup,
}) => {
  await page.goto(`${env.websiteUrl}/en/contact`)
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E')
  await page.getByRole('textbox', { name: 'Email' }).fill('e2e@example.com')
  await page.getByRole('textbox', { name: 'Message' }).fill('Hello from the e2e browser test.')
  // The spam guard rejects a submission sent less than 1.5 s after the form script started.
  await page.waitForTimeout(1_600)
  const posted = page.waitForResponse(
    (res) => res.url().endsWith('/api/form-submissions') && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Send' }).click()
  const { doc } = await json<{ doc: { id: string } }>(await posted, 201)
  cleanup(() => admin.delete(`/api/form-submissions/${doc.id}`))
  await expect(page.getByText('Thanks. We will be in touch.')).toBeVisible()
})

test('form recipients stay hidden from anonymous and API key reads', async ({
  cms,
  admin,
  create,
}) => {
  const recipient = 'e2e-recipient@example.com'
  const form = await create<{ id: string }>('forms', {
    data: {
      title: 'E2E recipients',
      confirmationType: 'redirect',
      redirect: { url: 'https://example.com' },
      fields: [{ blockType: 'text', name: 'name', label: 'Name' }],
      emails: [{ emailTo: recipient, subject: 'E2E' }],
    },
  })
  expect(await (await admin.get(`/api/forms/${form.id}`)).text()).toContain(recipient)
  for (const headers of [{}, readKey, previewKey]) {
    expect(await (await cms.get(`/api/forms/${form.id}`, { headers })).text()).not.toContain(
      recipient,
    )
  }
})

test('a form field named fax is refused with 400', async ({ admin }) => {
  const reserved = await admin.post('/api/forms', {
    data: { title: 'E2E reserved', fields: [{ blockType: 'text', name: 'fax', label: 'Fax' }] },
  })
  expect(reserved.status()).toBe(400)
  expect(await reserved.text()).toContain('reserved')
})
