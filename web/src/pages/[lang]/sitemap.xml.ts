import type { APIRoute, GetStaticPaths } from 'astro'

import { getStaticPathItems } from '../../cms/getStaticPaths'
import { escapedSiteURL, sitemapHeaders, urlEntry, urlsetDocument } from '../../cms/sitemap'
import { DEFAULT_LOCALE, isLocale, LOCALE_URL_PREFIX, LOCALES, type Locale } from '../../cms/types'

export const prerender = !import.meta.env.DEV

export const getStaticPaths: GetStaticPaths = () =>
  LOCALE_URL_PREFIX ? LOCALES.map((code) => ({ params: { lang: code } })) : []

export const GET: APIRoute = async ({ params }) => {
  if (!isLocale(params.lang)) {
    return new Response('Not found', { status: 404 })
  }
  const lang = params.lang
  const items = await getStaticPathItems()
  const entries: string[] = []

  for (const item of items) {
    const ownPath = item.paths[lang]
    if (!ownPath) continue
    const populated = Object.entries(item.paths).filter(
      (e): e is [Locale, string] => Boolean(e[1]),
    )
    if (populated.length === 0) continue
    const xDefault = item.paths[DEFAULT_LOCALE] ?? populated[0]![1]
    const alternateLinks = populated
      .map(
        ([code, p]) =>
          `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapedSiteURL(p)}" />`,
      )
      .concat(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapedSiteURL(xDefault)}" />`,
      )
    entries.push(urlEntry(ownPath, item.updatedAt, alternateLinks))
  }

  return new Response(urlsetDocument(entries, { xhtml: true }), { headers: sitemapHeaders })
}
