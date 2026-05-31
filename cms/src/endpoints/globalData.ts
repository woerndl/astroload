import { createHash } from 'crypto'
import { APIError, type PayloadRequest } from 'payload'

import type { Footer, Header, Labels, SiteSetting } from '../payload-types'
import { isLocale, LOCALES, pageCollectionsSlugs } from '../shared'
import { stripLocalePathsDeep } from '../stripLocalePath'

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
  const baseOptions = { draft: preview, locale, req }
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

    // Header and Footer carry populated nav-link paths; published responses
    // serve every populated path un-prefixed in single-locale mode. Preview
    // keeps the prefix so the admin live-preview routes still resolve.
    const body: GlobalData = preview
      ? { footer, header, labels, siteSettings }
      : stripLocalePathsDeep({ footer, header, labels, siteSettings })
    const json = JSON.stringify(body)
    const etag = createHash('md5').update(json).digest('hex')
    const cacheControl = preview ? 'no-cache' : `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        headers: { 'Cache-Control': cacheControl, ETag: etag },
        status: 304,
      })
    }

    return new Response(json, {
      headers: { 'Cache-Control': cacheControl, 'Content-Type': 'application/json', ETag: etag },
    })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'globalData endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
