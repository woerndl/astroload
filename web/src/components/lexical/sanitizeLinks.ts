import type { LexicalNode } from '@jhb.software/astro-payload-richtext-lexical'
import { ALLOWED_LINK_SCHEMES } from '@astroload/cms/src/shared'

// Dangerous: an absolute URL with a disallowed scheme (javascript:, data:), a
// protocol-relative `//host`, an ASCII control character, or a backslash.
// Browsers strip control characters and read a backslash as a slash in
// http(s) URLs, so '/\t/evil.com' and '/\evil.example' resolve as
// '//evil.com' and '//evil.example'. Relative and schemeless values are left
// to the renderer.
function isDangerousHref(url: string): boolean {
  const trimmed = url.trim()
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(trimmed)) return true
  if (trimmed.includes('\\')) return true
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

// LinkComponent throws during rendering on any link it cannot resolve to an
// href. This mirrors its checks and returns true for anything it would reject.
function isUnrenderableLink(fields: LinkFields | undefined): boolean {
  if (!fields) return true
  if (fields.linkType === 'internal') {
    const value = fields.doc?.value
    return !(
      value &&
      typeof value === 'object' &&
      typeof (value as { path?: unknown }).path === 'string'
    )
  }
  if (fields.linkType !== 'custom') return true
  // The renderer does not trim, so ' /blog' fails its startsWith('/') and
  // throws in its new URL(). Check the raw value for that reason.
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

// Links can bypass the CMS validator (cms/src/lexical/editor.ts) through draft
// autosave, seeds, imports, DB restores, or a richtext field without
// lexicalEditorWithSafeLinks. This unwraps unrenderable links to their plain
// text and drops malformed node lists and null entries, so the renderer does
// not throw on them.
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
