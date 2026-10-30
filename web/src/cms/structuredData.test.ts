import { expect, it } from 'vitest'

import { jsonLdText } from './structuredData'

it('jsonLdText adds the context and escapes "<" so the JSON parses back to the same values', () => {
  const node = {
    '@type': 'Article',
    description: '<p>A & B "C"</p></script>',
    url: 'https://example.com/en/posts?type=press&page=2',
  }
  const text = jsonLdText(node)
  expect(text).not.toContain('<')
  expect(JSON.parse(text)).toEqual({ '@context': 'https://schema.org', ...node })
})
