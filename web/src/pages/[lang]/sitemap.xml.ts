import type { APIRoute } from 'astro'

import { getStaticPathItems } from '../../cms/getStaticPaths'
import { escapedSiteURL, sitemapHeaders, urlEntry, urlsetDocument } from '../../cms/sitemap'
import { DEFAULT_LOCALE, isLocale, LOCALE_URL_PREFIX, MULTIPLE_LOCALES } from '../../cms/types'

// Rendered on demand in every build, so the locale guard below returns the 404
// for an unknown locale such as /fr/sitemap.xml, and the sitemaps reflect
// publishes without a redeploy. Before @astrojs/node 11.1.2 a prerendered
// dynamic endpoint answered it with a 500.
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
    // The page head emits hreflang alternates only with more than one locale,
    // so this checks the same flag. x-default also matches the head: it names
    // the default locale and is left out when that translation is missing.
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
