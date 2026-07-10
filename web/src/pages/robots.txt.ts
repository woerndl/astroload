import type { APIRoute } from 'astro'
import { DEFAULT_LOCALE } from '../cms/types'

import { getGlobalData } from '../cms/getGlobalData'
import { absoluteSiteURL } from '../cms/urls'

export const prerender = true

export const GET: APIRoute = async () => {
  const { siteSettings } = await getGlobalData({ locale: DEFAULT_LOCALE, preview: false })
  const allow = siteSettings.robots?.allowIndexing === true

  const body = allow
    ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteSiteURL('/sitemap.xml')}\n`
    : `User-agent: *\nDisallow: /\n`

  return new Response(body, {
    // Prerendered in production, where the static file's headers come from
    // the host. This header applies only when the route renders on demand (dev).
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
