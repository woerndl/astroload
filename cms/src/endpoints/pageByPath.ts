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
import { canPreview } from './canPreview'

interface PageByPathBody {
  collection: PageCollectionSlug
  data: unknown
  // The matched doc's path in every locale, so the web layer can build
  // alternates and canonicals without another request.
  paths: LocalePaths
}

// The pages-plugin `path` field is virtual and unindexed, so it can't be a
// `where` filter. Look up by slug, match the full path in memory, then load
// only the matched id at full depth. Colliding slugs are not populated.
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
  if (preview && !canPreview(req)) {
    return new Response('Forbidden', { status: 403 })
  }
  // Without URL prefixes, callers request the public, un-prefixed path. Preview
  // keeps the locale prefix so the live preview route stays the same.
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
          overrideAccess: false,
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

      // Load the full doc in the request locale and its `path` in every
      // locale. The `all` locale call does not get `req`, because Payload's
      // createLocalReq writes the locale onto the passed req, and two
      // concurrent calls with different locales would overwrite each other.
      // Passing `user` gives it a fresh request with the same access control.
      const [data, pathDoc] = await Promise.all([
        req.payload.findByID({
          collection,
          id: match.id,
          locale,
          draft: preview,
          depth: 2,
          overrideAccess: false,
          req,
        }),
        req.payload.findByID({
          collection,
          id: match.id,
          locale: 'all',
          draft: preview,
          overrideAccess: false,
          select: { path: true },
          depth: 0,
          user: req.user,
        }),
      ])
      const rawPaths = ((pathDoc as { path?: LocalePaths }).path ?? {}) as LocalePaths
      // Public requests get every path in the doc in public form, including
      // breadcrumbs and populated relations.
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
