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
          overrideAccess: false,
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

    // Slug uniqueness is per collection, so a Page and a Post can claim the
    // same public path, and the page lookup serves whichever collection
    // queries first. The warning makes the collision visible.
    const owners = new Map<string, string>()
    for (const item of items) {
      for (const [locale, path] of Object.entries(item.paths)) {
        // A locale key can hold undefined for an untranslated document. Those
        // are not paths, and treating them as one warns on every such pair.
        if (!path) continue
        const key = `${locale}:${path}`
        const owner = owners.get(key)
        if (owner) {
          req.payload.logger.warn(
            `public path ${path} (${locale}) is claimed by both ${owner} and ${item.collection}/${item.id}; the page lookup serves the first match`,
          )
        } else {
          owners.set(key, `${item.collection}/${item.id}`)
        }
      }
    }

    return new Response(JSON.stringify(items), {
      headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'application/json' },
    })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'staticPaths endpoint failed')
    throw new APIError('Internal server error', 500)
  }
}
