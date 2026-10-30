import { describe, expect, it } from 'vitest'

import { sanitizeLexicalLinks } from './sanitizeLinks'

const text = (value: string) => ({ type: 'text', text: value, version: 1 })
const link = (fields: Record<string, unknown>, label = 'label') => ({
  type: 'link',
  fields,
  children: [text(label)],
  version: 1,
})

describe('sanitizeLexicalLinks', () => {
  it('unwraps the renderer-throwing links to plain text', () => {
    const unrenderable = [
      link({ linkType: 'custom', url: '' }),
      link({ linkType: 'custom', url: 'javascript:alert(1)' }),
      link({ linkType: 'custom', url: '//evil.com' }), // protocol-relative, off-origin
      link({ linkType: 'custom', url: '/\t/evil.com' }), // tab smuggle: browsers resolve it as //evil.com
      link({ linkType: 'custom', url: '/\n/evil.com' }), // newline smuggle
      link({ linkType: 'custom', url: 'java\tscript:alert(1)' }), // control char hides the scheme
      link({ linkType: 'custom', url: '/\\evil.example' }), // backslash smuggle: browsers resolve it as //evil.example
      link({ linkType: 'custom', url: '\u00a0https://example.com' }), // NBSP defeats the renderer's new URL()
    ]
    for (const node of unrenderable) {
      expect(sanitizeLexicalLinks([node])).toEqual([text('label')])
    }
  })

  it('keeps a link the renderer can resolve', () => {
    const node = link({ linkType: 'custom', url: '/blog/post' })
    expect(sanitizeLexicalLinks([node])).toEqual([node])
  })

  it('recurses into children so a nested bad link is unwrapped', () => {
    const paragraph = {
      type: 'paragraph',
      children: [link({ linkType: 'custom', url: '' })],
      version: 1,
    }
    expect(sanitizeLexicalLinks([paragraph])).toEqual([
      { type: 'paragraph', children: [text('label')], version: 1 },
    ])
  })
})
