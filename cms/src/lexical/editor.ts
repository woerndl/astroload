import { LinkFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { ALLOWED_LINK_SCHEMES } from '../shared'

// The web renderer resolves exactly two link shapes: a root-relative path and
// an absolute URL with an allowed scheme. Everything else (anchors, queries,
// bare hostnames, protocol-relative `//host`) is unwrapped to plain text by
// the web sanitizer, so it is rejected here at save time instead of stored
// and silently dropped. ASCII control characters are rejected because
// browsers strip them while resolving a URL, which would let '/\t/evil.com'
// navigate off-origin as '//evil.com'.
function isAllowedLinkUrl(value: string): boolean {
  const url = value.trim()
  if (!url) return false
  if (/[\u0000-\u001f]/.test(url)) return false
  if (url.startsWith('//')) return false
  if (url.startsWith('/')) return true
  try {
    return ALLOWED_LINK_SCHEMES.includes(new URL(url).protocol)
  } catch {
    return false
  }
}

// The default link feature only rejects URLs with spaces, so a javascript:/data:
// URL would be stored and rendered as a live anchor. Swap the `url` validator for
// a scheme allowlist to close that for every editor inheriting this feature.
const safeLinkFeature = LinkFeature({
  fields: ({ defaultFields }) =>
    defaultFields.map((field) => {
      if (!('name' in field) || field.name !== 'url') return field
      return {
        ...field,
        validate: (value: string | null | undefined, options: { siblingData?: { linkType?: string } }) => {
          if (options?.siblingData?.linkType === 'internal') return true
          if (typeof value !== 'string' || !value.trim() || value.includes(' ')) {
            return 'Invalid URL'
          }
          if (!isAllowedLinkUrl(value)) {
            return 'Links must be a root-relative path (/like/this) or an absolute http, https, mailto, or tel URL.'
          }
          return true
        },
      } as typeof field
    }),
})

// Matches Payload's own `defaultFeatures` typing. Per-feature props generics vary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LexicalFeature = FeatureProviderServer<any, any, any>

// Default features with the scheme-checked link feature swapped in, plus any extras.
export function lexicalEditorWithSafeLinks(extraFeatures: LexicalFeature[] = []) {
  return lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((feature) => feature.key !== 'link'),
      safeLinkFeature,
      ...extraFeatures,
    ],
  })
}
