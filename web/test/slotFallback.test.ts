import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it } from 'vitest'

import SlotCases from './fixtures/SlotCases.astro'

const render = async (show: boolean) =>
  (await AstroContainer.create()).renderToString(SlotCases, { props: { show } })

const footers = (html: string, testCase: string) =>
  [
    ...(html.split(`data-case="${testCase}"`)[1]?.split('</section>')[0] ?? '').matchAll(
      /<footer>(.*?)<\/footer>/g,
    ),
  ].map(([, content]) => content)

describe('a component with an optional slot', () => {
  it('renders a footer without the slot text when the condition is false and the parent passes no prop', async () => {
    const html = await render(false)
    for (const testCase of ['element', 'fragment', 'text']) {
      expect(footers(html, testCase), testCase).toHaveLength(1)
      expect(footers(html, testCase)[0], testCase).not.toContain('Footer')
    }
  })

  it('renders no footer when the parent passes a false prop or no slot', async () => {
    const html = await render(false)
    expect(footers(html, 'prop')).toEqual([])
    expect(footers(html, 'no-slot')).toEqual([])
  })

  it('renders the slot content in the footer when the condition holds', async () => {
    const html = await render(true)
    for (const testCase of ['element', 'fragment', 'text', 'prop']) {
      expect(footers(html, testCase), testCase).toHaveLength(1)
      expect(footers(html, testCase)[0], testCase).toContain('Footer')
    }
  })
})
