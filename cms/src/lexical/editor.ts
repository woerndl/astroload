import { LinkFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { FeatureProviderServer } from '@payloadcms/richtext-lexical'

const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

// Schemeless values (relative paths, anchors, bare hosts) parse as no URL and
// are allowed; absolute URLs must use an allowed scheme, rejecting javascript:
// and data:.
function isAllowedLinkUrl(value: string): boolean {
  const url = value.trim()
  if (!url || /^[/#?]/.test(url)) return true
  try {
    return ALLOWED_LINK_SCHEMES.includes(new URL(url).protocol)
  } catch {
    return true
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
            return 'Links must use http, https, mailto, tel, or a relative path.'
          }
          return true
        },
      } as typeof field
    }),
})

// Matches Payload's own `defaultFeatures` typing; per-feature props generics vary.
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
