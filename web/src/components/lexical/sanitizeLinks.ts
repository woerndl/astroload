import type { LexicalNode } from '@jhb.software/astro-payload-richtext-lexical'
import { ALLOWED_LINK_SCHEMES } from '@astroload/cms/src/shared'

// Dangerous: absolute URLs with a disallowed scheme (javascript:, data:),
// protocol-relative `//host` (off-origin), and anything holding an ASCII
// control character, which browsers strip while resolving a URL, so
// '/\t/evil.com' would navigate off-origin as '//evil.com'.
// Relative/schemeless are left to the renderer.
function isDangerousHref(url: string): boolean {
  const trimmed = url.trim()
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(trimmed)) return true
  if (trimmed.startsWith('//')) return true
  if (!trimmed || trimmed.startsWith('/')) return false
  try {
    return !ALLOWED_LINK_SCHEMES.includes(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

type LinkFields = {
  linkType?: 'custom' | 'internal'
  url?: string
  doc?: { value?: unknown } | null
}

// LinkComponent throws during SSR rendering on any link it can't resolve to an
// href. Mirror its accept conditions: true for anything it would reject.
function isUnrenderableLink(fields: LinkFields | undefined): boolean {
  if (!fields) return true
  if (fields.linkType === 'internal') {
    const value = fields.doc?.value
    return !(value && typeof value === 'object' && typeof (value as { path?: unknown }).path === 'string')
  }
  if (fields.linkType !== 'custom') return true
  // Check the raw value, not a trimmed copy: the renderer does not trim, so
  // ' /blog' fails its startsWith('/') and throws in its new URL().
  const url = typeof fields.url === 'string' ? fields.url : ''
  if (!url) return true
  if (isDangerousHref(url)) return true
  if (url.startsWith('/')) return false
  try {
    new URL(url)
    return false
  } catch {
    return true
  }
}

// Sink-side guard for links that bypass the CMS validator
// (cms/src/lexical/editor.ts): draft autosave, seeds, imports, DB restores, or a
// richtext field wired without lexicalEditorWithSafeLinks. Unwrap unrenderable
// links to plain text, and drop a malformed node list or null entry, rather than
// letting the renderer throw on them.
export function sanitizeLexicalLinks(nodes: LexicalNode[]): LexicalNode[] {
  if (!Array.isArray(nodes)) return []
  return nodes.flatMap((node) => {
    if (!node || typeof node !== 'object') return []
    const children = Array.isArray(node.children)
      ? sanitizeLexicalLinks(node.children)
      : node.children
    const isLink = node.type === 'link' || node.type === 'autolink'
    if (isLink) {
      if (isUnrenderableLink(node.fields as LinkFields | undefined)) {
        return children ?? []
      }
    }
    return children === node.children ? node : { ...node, children }
  })
}
