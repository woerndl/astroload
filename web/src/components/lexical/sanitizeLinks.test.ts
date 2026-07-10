import type { LexicalNode } from '@jhb.software/astro-payload-richtext-lexical'
import { describe, expect, it } from 'vitest'

import { sanitizeLexicalLinks } from './sanitizeLinks'

const text = (value: string) => ({ type: 'text', text: value, version: 1 })
const link = (fields: Record<string, unknown>, label = 'label') => ({
  type: 'link',
  fields,
  children: [text(label)],
  version: 1,
})

// Each input is a link the renderer would throw on. The sanitizer must unwrap
// each to its plain-text children instead.
describe('sanitizeLexicalLinks', () => {
  it('unwraps the renderer-throwing links to plain text', () => {
    const unrenderable = [
      link({ linkType: 'custom', url: '' }), // empty url
      link({ linkType: 'custom', url: '   ' }), // whitespace url
      link({ linkType: 'custom', url: 'https://' }), // no host, new URL() throws
      link({ linkType: 'custom', url: ' /blog' }), // leading space defeats the renderer's startsWith('/')
      link({ linkType: 'custom', url: '#anchor' }), // bare fragment
      link({ linkType: 'custom', url: 'just words' }), // not a url
      link({ linkType: 'custom', url: 'javascript:alert(1)' }), // dangerous scheme
      link({ linkType: 'custom', url: '//evil.com' }), // protocol-relative, off-origin
      link({ linkType: 'custom', url: '/\t/evil.com' }), // tab smuggle: browsers resolve it as //evil.com
      link({ linkType: 'custom', url: '/\n/evil.com' }), // newline smuggle
      link({ linkType: 'custom', url: 'java\tscript:alert(1)' }), // control char hides the scheme
      link({ linkType: 'custom', url: '/\\evil.example' }), // backslash smuggle: browsers resolve it as //evil.example
      link({ linkType: 'custom', url: '\u00a0https://example.com' }), // NBSP defeats the renderer's new URL()
      link({ linkType: 'internal', doc: null }), // unpopulated internal link
      link({ linkType: undefined as unknown as string }), // unknown linkType
    ]
    for (const node of unrenderable) {
      expect(sanitizeLexicalLinks([node])).toEqual([text('label')])
    }
  })

  it('keeps the links the renderer can resolve', () => {
    const renderable = [
      link({ linkType: 'custom', url: '/blog/post' }), // root-relative
      link({ linkType: 'custom', url: 'https://example.com' }), // absolute
      link({ linkType: 'custom', url: 'mailto:hi@example.com' }), // mailto
      link({ linkType: 'internal', doc: { value: { path: '/de/page' } } }), // populated
    ]
    for (const node of renderable) {
      expect(sanitizeLexicalLinks([node])).toEqual([node])
    }
  })

  it('recurses into children so a nested bad link is unwrapped', () => {
    const paragraph = { type: 'paragraph', children: [link({ linkType: 'custom', url: '' })], version: 1 }
    expect(sanitizeLexicalLinks([paragraph])).toEqual([
      { type: 'paragraph', children: [text('label')], version: 1 },
    ])
  })

  it('tolerates malformed input instead of throwing', () => {
    expect(sanitizeLexicalLinks(null as unknown as LexicalNode[])).toEqual([])
    expect(sanitizeLexicalLinks('oops' as unknown as LexicalNode[])).toEqual([])
    expect(sanitizeLexicalLinks([null, undefined, text('keep')] as unknown as LexicalNode[])).toEqual([
      text('keep'),
    ])
  })
})
