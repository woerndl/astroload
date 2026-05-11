import type { APIRoute, GetStaticPaths } from 'astro'

import { DEFAULT_LOCALE, LOCALES } from '@astroload/cms/src/shared'

import { getStaticPathItems } from '../../cms/getStaticPaths'
import { isLocale, type Locale } from '../../cms/types'
import { absoluteSiteURL } from '../../cms/urls'

export const prerender = !import.meta.env.DEV

export const getStaticPaths: GetStaticPaths = () =>
  LOCALES.map((code) => ({ params: { lang: code } }))

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function absolute(localePath: string): string {
  return escapeXml(absoluteSiteURL(localePath))
}

export const GET: APIRoute = async ({ params }) => {
  if (!isLocale(params.lang)) {
    return new Response('Not found', { status: 404 })
  }
  const lang = params.lang
  const items = await getStaticPathItems()
  const urls: string[] = []

  for (const item of items) {
    const ownPath = item.paths[lang]
    if (!ownPath) continue
    const populated = Object.entries(item.paths).filter(
      (e): e is [Locale, string] => Boolean(e[1]),
    )
    if (populated.length === 0) continue
    const xDefault = item.paths[DEFAULT_LOCALE] ?? populated[0]![1]
    const altLinks = populated
      .map(
        ([code, p]) =>
          `    <xhtml:link rel="alternate" hreflang="${code}" href="${absolute(p)}" />`,
      )
      .concat(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${absolute(xDefault)}" />`,
      )
      .join('\n')
    urls.push(
      `  <url>\n    <loc>${absolute(ownPath)}</loc>\n    <lastmod>${escapeXml(item.updatedAt)}</lastmod>\n${altLinks}\n  </url>`,
    )
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    urls.join('\n') +
    `\n</urlset>\n`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
