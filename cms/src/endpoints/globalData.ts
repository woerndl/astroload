import { APIError, type PayloadRequest } from 'payload'

import type { Footer, Header, Labels, SiteSetting } from '../payload-types'
import { isLocale, LOCALES, pageCollectionsSlugs } from '../shared'
import { stripLocalePathsDeep } from '../stripLocalePath'
import { canPreview } from './canPreview'

export interface GlobalData {
  footer: Footer
  header: Header
  labels: Labels
  siteSettings: SiteSetting
}

const PUBLIC_MAX_AGE_SECONDS = 60

export async function getGlobalData(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const locale = req.query.locale
  if (!isLocale(locale)) {
    return new Response(`locale is required, one of: ${LOCALES.join(', ')}`, { status: 400 })
  }

  const preview = req.query.preview === 'true'
  if (preview && !canPreview(req)) {
    return new Response('Forbidden', { status: 403 })
  }
  const baseOptions = { draft: preview, locale, overrideAccess: false, req }
  const populatePagePaths = Object.fromEntries(
    pageCollectionsSlugs.map((slug) => [slug, { path: true }]),
  )

  try {
    const [header, footer, labels, siteSettings] = await Promise.all([
      req.payload.findGlobal({ slug: 'header', populate: populatePagePaths, ...baseOptions }),
      req.payload.findGlobal({ slug: 'footer', populate: populatePagePaths, ...baseOptions }),
      req.payload.findGlobal({ slug: 'labels', ...baseOptions }),
      req.payload.findGlobal({ slug: 'site-settings', ...baseOptions }),
    ])

    // Header and Footer carry populated nav-link paths. Published responses
    // serve every populated path un-prefixed in single-locale mode. Preview
    // keeps the prefix so the admin live-preview routes still resolve.
    const body: GlobalData = preview
      ? { footer, header, labels, siteSettings }
      : stripLocalePathsDeep({ footer, header, labels, siteSettings })
    // private: the response requires an API key, so a shared cache must not
    // serve it across clients.
    const cacheControl = preview ? 'no-cache' : `private, max-age=${PUBLIC_MAX_AGE_SECONDS}`

    return new Response(JSON.stringify(body), {
      headers: { 'Cache-Control': cacheControl, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'globalData endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
