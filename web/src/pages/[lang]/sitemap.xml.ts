import type { APIRoute } from 'astro'

import { getStaticPathItems } from '../../cms/getStaticPaths'
import { escapedSiteURL, sitemapHeaders, urlEntry, urlsetDocument } from '../../cms/sitemap'
import { DEFAULT_LOCALE, isLocale, LOCALE_URL_PREFIX, MULTIPLE_LOCALES } from '../../cms/types'

// Rendered on demand in every build. A prerendered dynamic endpoint has no
// 404 path in the Node adapter (only prerendered pages are exempt from
// on-demand rendering), so /fr/sitemap.xml would answer 500 from the
// renderer. Per request, the locale guard below turns that into a 404, and
// the per-locale sitemaps track publishes without waiting for a redeploy.
export const prerender = false

export const GET: APIRoute = async ({ params }) => {
  // The sitemap of an unprefixed build lives at /sitemap.xml, so every
  // /{lang} variant 404s rather than serving a duplicate.
  if (!LOCALE_URL_PREFIX || !isLocale(params.lang)) {
    return new Response('Not found', { status: 404 })
  }
  const lang = params.lang
  const items = await getStaticPathItems()
  const entries: string[] = []

  for (const item of items) {
    const ownPath = item.paths[lang]
    if (!ownPath) continue
    // hreflang alternates only exist with more than one locale, so a forced
    // prefix alone stays in sync with the page head, which gates on the same
    // flag. x-default matches the head too: it names the configured default
    // locale and is omitted when that translation is missing.
    const alternateLinks: string[] = []
    if (MULTIPLE_LOCALES) {
      for (const [code, path] of Object.entries(item.paths)) {
        if (!path) continue
        alternateLinks.push(
          `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapedSiteURL(path)}" />`,
        )
      }
      const xDefault = item.paths[DEFAULT_LOCALE]
      if (xDefault) {
        alternateLinks.push(
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapedSiteURL(xDefault)}" />`,
        )
      }
    }
    entries.push(urlEntry(ownPath, item.updatedAt, alternateLinks))
  }

  return new Response(urlsetDocument(entries, { xhtml: MULTIPLE_LOCALES }), {
    headers: sitemapHeaders,
  })
}
