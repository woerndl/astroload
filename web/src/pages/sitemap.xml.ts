import type { APIRoute } from 'astro'

import { LOCALES } from '../cms/types'

import { absoluteSiteURL } from '../cms/urls'

export const prerender = !import.meta.env.DEV

export const GET: APIRoute = () => {
  const entries = LOCALES.map(
    (code) => `  <sitemap>\n    <loc>${absoluteSiteURL(`/${code}/sitemap.xml`)}</loc>\n  </sitemap>`,
  )

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join('\n') +
    `\n</sitemapindex>\n`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
