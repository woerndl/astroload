import type { APIRoute } from 'astro'

import { getGlobalData } from '../cms/getGlobalData'
import { absoluteSiteURL } from '../cms/urls'

export const prerender = !import.meta.env.DEV

export const GET: APIRoute = async () => {
  const { siteSettings } = await getGlobalData({ locale: 'en', preview: false })
  const allow = siteSettings.robots?.allowIndexing === true

  const body = allow
    ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteSiteURL('/sitemap.xml')}\n`
    : `User-agent: *\nDisallow: /\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
