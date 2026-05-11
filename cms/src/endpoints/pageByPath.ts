import { APIError, type PayloadRequest } from 'payload'

import { isLocale, LOCALES, type PageCollectionSlug, pageCollectionsSlugs } from '../shared'

interface PageByPathBody {
  collection: PageCollectionSlug
  data: unknown
}

// The pages-plugin `path` field is virtual and not indexed, so it cannot be
// used as a `where` filter. Look up by the last URL segment (the document
// slug) and match the full path in memory. Root pages have an empty slug.
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
    const results = await Promise.all(
      pageCollectionsSlugs.map((collection) =>
        req.payload.find({
          collection,
          locale,
          draft: preview,
          where: {
            slug: { equals: slug },
            _status: preview ? { in: ['draft', 'published'] } : { equals: 'published' },
          },
          limit: 0,
          req,
        }),
      ),
    )

    for (const [i, result] of results.entries()) {
      const match = (result.docs as Array<{ path?: string }>).find(
        (doc) => doc.path === fullPath,
      )
      if (match) {
        const body: PageByPathBody = {
          collection: pageCollectionsSlugs[i]!,
          data: match,
        }
        return Response.json(body, { headers: { 'Cache-Control': 'no-cache' } })
      }
    }

    return new Response(null, { status: 404 })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'pageByPath endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
