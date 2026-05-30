import type { LexicalNode } from '@jhb.software/astro-payload-richtext-lexical'

const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

// Dangerous: absolute URLs with a disallowed scheme (javascript:, data:) and
// protocol-relative `//host` (off-origin). Relative/schemeless are left to the renderer.
function isDangerousHref(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed.startsWith('//')) return true
  if (!trimmed || trimmed.startsWith('/')) return false
  try {
    return !ALLOWED_LINK_SCHEMES.includes(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

// Sink-side guard for links that never hit the CMS validator
// (cms/src/lexical/editor.ts): seeds, imports, DB restores, or a richtext field
// added without lexicalEditorWithSafeLinks. Unwrap to plain text rather than
// blank the href, which the renderer throws on.
export function sanitizeLexicalLinks(nodes: LexicalNode[]): LexicalNode[] {
  return nodes.flatMap((node) => {
    const children = Array.isArray(node.children)
      ? sanitizeLexicalLinks(node.children)
      : node.children
    const isLink = node.type === 'link' || node.type === 'autolink'
    const url = (node.fields as { url?: string } | undefined)?.url
    if (isLink && typeof url === 'string' && isDangerousHref(url)) {
      return children ?? []
    }
    return children === node.children ? node : { ...node, children }
  })
}
