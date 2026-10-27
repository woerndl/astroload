import { expect, test } from './fixtures'

type Variant = { url: string | null; width: number; height: number; mimeType: string }

test('an upload yields every image size and a 1200x630 JPEG og variant, and the file route serves each with a long Cache-Control', async ({
  page,
  cms,
  admin,
  cleanup,
}) => {
  // Payload skips a size wider than the source.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1280
    canvas.getContext('2d')!.fillRect(400, 300, 1120, 680)
    return canvas.toDataURL('image/png')
  })
  const created = await admin.post('/api/media?locale=en', {
    multipart: {
      file: {
        name: 'e2e-upload.png',
        mimeType: 'image/png',
        buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
      },
      _payload: JSON.stringify({ alt: 'E2E upload' }),
    },
  })
  await expect(created).toBeOK()
  const { doc } = await created.json()
  cleanup(() => admin.delete(`/api/media/${doc.id}`))
  expect(doc.sizes.og).toMatchObject({ width: 1200, height: 630, mimeType: 'image/jpeg' })
  for (const [name, variant] of Object.entries<Variant>(doc.sizes)) {
    expect(variant.url, name).toBeTruthy()
    const file = await cms.get(variant.url!)
    expect(file.status(), name).toBe(200)
    expect(file.headers()['content-type'], name).toBe(variant.mimeType)
    expect(file.headers()['cache-control'], name).toMatch(/max-age=\d{6,}/)
  }
})

test('the /en page renders an img whose srcset uses width descriptors', async ({ web }) => {
  const res = await web.get('/en')
  expect(res.status()).toBe(200)
  expect(await res.text()).toMatch(/<img[^>]+srcset="[^"]+ \d+w/)
})
