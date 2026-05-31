import { absoluteSiteURL } from './urls'

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Escape a site-relative path and resolve it to an absolute URL.
export function escapedSiteURL(localePath: string): string {
  return escapeXml(absoluteSiteURL(localePath))
}

// Build one `<url>` entry. `alternateLinks` are pre-rendered `<xhtml:link>`
// lines (already indented), appended verbatim before the closing tag; the
// single-locale sitemap passes none.
export function urlEntry(loc: string, lastmod: string, alternateLinks: string[] = []): string {
  const head = `  <url>\n    <loc>${escapedSiteURL(loc)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>`
  const tail = '\n  </url>'
  return alternateLinks.length === 0 ? `${head}${tail}` : `${head}\n${alternateLinks.join('\n')}${tail}`
}

// Wrap `<url>` entries in a `<urlset>` document. `xhtml` adds the xhtml
// namespace declaration the alternate-link sitemap needs.
export function urlsetDocument(entries: string[], options: { xhtml?: boolean } = {}): string {
  const namespaces = options.xhtml
    ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset ${namespaces}>\n` +
    entries.join('\n') +
    `\n</urlset>\n`
  )
}

export const sitemapHeaders = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
}
