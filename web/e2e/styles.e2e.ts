import { env, expect, test } from './fixtures'

const LAYER_ORDER = '@layer astro.images, tokens, base, components, utilities;'

test('the layer statement is the first style in head, before any stylesheet', async ({ page }) => {
  for (const path of ['/en', '/en/contact', '/en/does-not-exist', '/styleguide']) {
    await page.goto(`${env.websiteUrl}${path}`)
    const first = await page.evaluate(() => {
      const el = document.head.querySelector('style, link[rel~="stylesheet"]')
      return el && { tag: el.tagName, attributes: el.attributes.length, text: el.textContent }
    })
    expect(first, path).toEqual({ tag: 'STYLE', attributes: 0, text: LAYER_ORDER })
  }
})
