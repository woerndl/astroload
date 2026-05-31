import { APIError, type PayloadRequest } from 'payload'

import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type LocalePaths,
  LOCALE_URL_PREFIX,
  LOCALES,
  type PageCollectionSlug,
  pageCollectionsSlugs,
} from '../shared'
import { stripLocalePath, stripLocalePathsDeep, toPublicPaths } from '../stripLocalePath'

interface PageByPathBody {
  collection: PageCollectionSlug
  data: unknown
  // The matched doc's path in every locale, so the web layer resolves
  // alternates and canonicals without a separate all-paths fetch.
  paths: LocalePaths
}

// The pages-plugin `path` field is virtual and unindexed, so it can't be a
// `where` filter. Look up by slug, match the full path in memory, then load
// only the matched id at full depth. Colliding slugs are never populated.
// Root pages have an empty slug.
export async function getPageByPath(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const fullPath = req.query.path
  if (typeof fullPath !== 'string' || !fullPath.startsWith('/')) {
    return new Response('path query param is required and must start with /', { status: 400 })
  }
  if (fullPath.endsWith('/') && fullPath !== '/') {
    return new Response('path must not end with a trailing slash', { status: 400 })
  }

  const preview = req.query.preview === 'true'
  // Single-locale projects request public, un-prefixed paths; preview keeps the
  // prefixed scheme end to end so the live-preview route is unchanged.
  const usePublicPath = !LOCALE_URL_PREFIX && !preview

  const segments = fullPath.split('/').filter(Boolean)
  let locale: Locale
  let slug: string
  if (usePublicPath) {
    locale = DEFAULT_LOCALE
    slug = segments.length === 0 ? '' : (segments.at(-1) ?? '')
  } else {
    const localeFromPath = segments[0]
    if (!isLocale(localeFromPath)) {
      return new Response(`path must start with /${LOCALES.join(' or /')}`, { status: 400 })
    }
    locale = localeFromPath
    slug = segments.length <= 1 ? '' : (segments.at(-1) ?? '')
  }

  try {
    const lookups = await Promise.all(
      pageCollectionsSlugs.map((collection) =>
        req.payload.find({
          collection,
          locale,
          draft: preview,
          where: {
            slug: { equals: slug },
            _status: preview ? { in: ['draft', 'published'] } : { equals: 'published' },
          },
          select: { path: true },
          depth: 0,
          limit: 0,
          req,
        }),
      ),
    )

    for (const [i, lookup] of lookups.entries()) {
      const collection = pageCollectionsSlugs[i]!
      const match = (lookup.docs as Array<{ id: string | number; path?: string }>).find(
        (doc) => (usePublicPath ? stripLocalePath(doc.path ?? '') : doc.path) === fullPath,
      )
      if (!match) continue

      // Load the full doc at the request locale for rendering, and the same
      // doc's `path` across every locale (cheap id lookup, virtual field only)
      // so the response carries the alternate paths the web layer needs.
      const [data, pathDoc] = await Promise.all([
        req.payload.findByID({ collection, id: match.id, locale, draft: preview, req }),
        req.payload.findByID({
          collection,
          id: match.id,
          locale: 'all',
          draft: preview,
          select: { path: true },
          depth: 0,
          req,
        }),
      ])
      const rawPaths = ((pathDoc as { path?: LocalePaths }).path ?? {}) as LocalePaths
      // Public single-locale requests get the doc, breadcrumbs, and populated
      // relations in public form; preview keeps the prefix.
      const body: PageByPathBody = {
        collection,
        data: usePublicPath ? stripLocalePathsDeep(data) : data,
        paths: usePublicPath ? toPublicPaths(rawPaths) : rawPaths,
      }
      return Response.json(body, { headers: { 'Cache-Control': 'no-cache' } })
    }

    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'pageByPath endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
