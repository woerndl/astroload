import { LinkFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { ALLOWED_LINK_SCHEMES } from '../shared'

// The web renderer handles two link shapes: a root-relative path and an
// absolute URL with an allowed scheme. Its sanitizer unwraps everything else
// (anchors, queries, bare hostnames, protocol-relative `//host`) to plain
// text, so those fail here at save time. Browsers strip ASCII control
// characters while resolving a URL and treat backslashes as slashes in http(s)
// URLs, so '/\t/evil.com' and '/\evil.example' would navigate off-origin.
// The value is checked untrimmed because the renderer resolves the raw value.
function isAllowedLinkUrl(url: string): boolean {
  if (!url) return false
  if (/[\u0000-\u001f]/.test(url)) return false
  if (url.includes('\\')) return false
  if (url.startsWith('//')) return false
  if (url.startsWith('/')) return true
  try {
    return ALLOWED_LINK_SCHEMES.includes(new URL(url).protocol)
  } catch {
    return false
  }
}

// The default link feature only rejects URLs with spaces, so it would store
// javascript: and data: URLs and render them as live links. This replaces the
// `url` validator with the scheme allowlist.
const safeLinkFeature = LinkFeature({
  fields: ({ defaultFields }) =>
    defaultFields.map((field) => {
      if (!('name' in field) || field.name !== 'url') return field
      return {
        ...field,
        validate: (
          value: string | null | undefined,
          options: { siblingData?: { linkType?: string } },
        ) => {
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

export function lexicalEditorWithSafeLinks(extraFeatures: LexicalFeature[] = []) {
  return lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((feature) => feature.key !== 'link'),
      safeLinkFeature,
      ...extraFeatures,
    ],
  })
}
