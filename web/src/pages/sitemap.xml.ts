import type { APIRoute } from 'astro'

import { getStaticPathItems } from '../cms/getStaticPaths'
import { sitemapHeaders, urlEntry, urlsetDocument } from '../cms/sitemap'
import { DEFAULT_LOCALE, LOCALE_URL_PREFIX, LOCALES } from '../cms/types'
import { absoluteSiteURL } from '../cms/urls'

export const prerender = !import.meta.env.DEV

export const GET: APIRoute = async () => {
  // Single-locale: one un-prefixed URL set. Multi-locale: an index pointing at
  // each per-locale sitemap.
  if (!LOCALE_URL_PREFIX) {
    const items = await getStaticPathItems()
    const entries = items
      .map((item) => {
        const loc = item.paths[DEFAULT_LOCALE]
        return loc ? urlEntry(loc, item.updatedAt) : null
      })
      .filter((entry): entry is string => entry !== null)

    return new Response(urlsetDocument(entries), { headers: sitemapHeaders })
  }

  const entries = LOCALES.map(
    (code) => `  <sitemap>\n    <loc>${absoluteSiteURL(`/${code}/sitemap.xml`)}</loc>\n  </sitemap>`,
  )

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join('\n') +
    `\n</sitemapindex>\n`

  return new Response(xml, { headers: sitemapHeaders })
}
