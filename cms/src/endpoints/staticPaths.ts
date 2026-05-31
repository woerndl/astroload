import { createHash } from 'crypto'
import { APIError, type PayloadRequest } from 'payload'

import { type Locale, type PageCollectionSlug, pageCollectionsSlugs } from '../shared'
import { toPublicPaths } from '../stripLocalePath'

interface PathDoc {
  id: string | number
  path: Partial<Record<Locale, string>>
  updatedAt: string
}

export interface StaticPathItem {
  collection: PageCollectionSlug
  id: string | number
  paths: Partial<Record<Locale, string>>
  updatedAt: string
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
          select: { path: true, updatedAt: true },
          where: { _status: { equals: 'published' } },
          req,
        }),
      ),
    )

    const items: StaticPathItem[] = []
    for (const [i, collection] of pageCollectionsSlugs.entries()) {
      const docs = results[i]!.docs as PathDoc[]
      for (const doc of docs) {
        items.push({ collection, id: doc.id, paths: toPublicPaths(doc.path), updatedAt: doc.updatedAt })
      }
    }

    const body = JSON.stringify(items)
    const etag = createHash('md5').update(body).digest('hex')

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        headers: { 'Cache-Control': 'no-cache', ETag: etag },
        status: 304,
      })
    }

    return new Response(body, {
      headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'application/json', ETag: etag },
    })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'staticPaths endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
