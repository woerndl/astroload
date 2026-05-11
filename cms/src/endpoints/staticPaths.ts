import { createHash } from 'crypto'
import { APIError, type PayloadRequest } from 'payload'

import { type Locale, type PageCollectionSlug, pageCollectionsSlugs } from '../shared'

interface PathDoc {
  id: string | number
  path: Partial<Record<Locale, string>>
}

export interface StaticPathItem {
  collection: PageCollectionSlug
  id: string | number
  paths: Partial<Record<Locale, string>>
}

export async function getStaticPaths(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const results = await Promise.all(
      pageCollectionsSlugs.map((collection) =>
        req.payload.find({
          collection,
          depth: 0,
          limit: 0,
          locale: 'all',
          select: { path: true },
          where: { _status: { equals: 'published' } },
        }),
      ),
    )

    const items: StaticPathItem[] = []
    for (const [i, collection] of pageCollectionsSlugs.entries()) {
      const docs = results[i]!.docs as PathDoc[]
      for (const doc of docs) {
        items.push({ collection, id: doc.id, paths: doc.path })
      }
    }

    const etag = createHash('md5').update(JSON.stringify(items)).digest('hex')
    const cacheControl = 'no-cache'

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        headers: { 'Cache-Control': cacheControl, ETag: etag },
        status: 304,
      })
    }

    return Response.json(items, {
      headers: { 'Cache-Control': cacheControl, ETag: etag },
    })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'staticPaths endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
