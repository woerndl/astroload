import { APIError, type PayloadRequest } from 'payload'

import { isLocale, LOCALES, type PageCollectionSlug, pageCollectionsSlugs } from '../shared'

interface PageByPathBody {
  collection: PageCollectionSlug
  data: unknown
}

// The pages-plugin `path` field is virtual and unindexed, so it can't be a
// `where` filter. Look up by slug, match the full path in memory, then load
// only the matched id at full depth — colliding slugs are never populated.
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

  const segments = fullPath.split('/').filter(Boolean)
  const localeFromPath = segments[0]
  if (!isLocale(localeFromPath)) {
    return new Response(`path must start with /${LOCALES.join(' or /')}`, { status: 400 })
  }
  const locale = localeFromPath
  const slug = segments.length <= 1 ? '' : (segments.at(-1) ?? '')
  const preview = req.query.preview === 'true'

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
        (doc) => doc.path === fullPath,
      )
      if (!match) continue

      const data = await req.payload.findByID({ collection, id: match.id, locale, draft: preview, req })
      const body: PageByPathBody = { collection, data }
      return Response.json(body, { headers: { 'Cache-Control': 'no-cache' } })
    }

    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'pageByPath endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
