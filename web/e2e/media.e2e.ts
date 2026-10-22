import { expect, test } from './fixtures'

type Variant = { url: string; width: number; height: number; mimeType: string }
type MediaDoc = { id: string; sizes: Record<'xs' | 'sm' | 'md' | 'lg' | 'og', Variant> }

test('an upload yields four WebP variants and a 1200x630 JPEG og variant, and the file route serves them with a 30-day Cache-Control', async ({
  page,
  cms,
  create,
}) => {
  // The browser draws the source image, which avoids an image library. It is
  // 1920 px wide because Payload skips a variant wider than the source.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1280
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#4a7'
    ctx.fillRect(0, 0, 1920, 1280)
    ctx.fillStyle = '#fff'
    ctx.fillRect(400, 300, 1120, 680)
    return canvas.toDataURL('image/png')
  })
  const doc = await create<MediaDoc>('media?locale=en', {
    multipart: {
      file: {
        name: 'e2e-upload.png',
        mimeType: 'image/png',
        buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
      },
      _payload: JSON.stringify({ alt: 'E2E upload' }),
    },
  })
  for (const [name, width] of [
    ['xs', 480],
    ['sm', 768],
    ['md', 1024],
    ['lg', 1920],
  ] as const) {
    expect(doc.sizes[name], name).toMatchObject({ width, mimeType: 'image/webp' })
    expect(doc.sizes[name].url).toMatch(/\.webp$/)
  }
  expect(doc.sizes.og).toMatchObject({ width: 1200, height: 630, mimeType: 'image/jpeg' })

  const file = await cms.get(doc.sizes.xs.url)
  expect(file.status()).toBe(200)
  expect(file.headers()['content-type']).toBe('image/webp')
  expect(file.headers()['cache-control']).toBe('public, max-age=2592000')
})

test('the /en page renders an img whose srcset uses width descriptors', async ({ web }) => {
  const res = await web.get('/en')
  expect(res.status()).toBe(200)
  expect(await res.text()).toMatch(/<img[^>]+srcset="[^"]+ \d+w/)
})
