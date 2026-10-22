import { APIError, type PayloadRequest } from 'payload'

import { type Locale, type PageCollectionSlug, pageCollectionsSlugs } from '../shared'
import { toPublicPaths } from '../stripLocalePath'

interface PathDoc {
  id: string | number
  path: Partial<Record<Locale, string>>
  updatedAt: string
  template?: string
}

export interface StaticPathItem {
  collection: PageCollectionSlug
  id: string | number
  paths: Partial<Record<Locale, string>>
  updatedAt: string
  // Set for pages only. 'default' renders the sections blocks.
  template?: string
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
          select:
            collection === 'pages'
              ? { path: true, updatedAt: true, template: true }
              : { path: true, updatedAt: true },
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
        items.push({
          collection,
          id: doc.id,
          paths: toPublicPaths(doc.path),
          updatedAt: doc.updatedAt,
          ...(doc.template && { template: doc.template }),
        })
      }
    }

    // Slugs are unique per collection only, so a page and a post can claim the
    // same public path. pageByPath then serves the first collection in
    // pageCollectionsSlugs.
    const owners = new Map<string, string>()
    for (const item of items) {
      for (const [locale, path] of Object.entries(item.paths)) {
        // An untranslated document holds undefined for that locale. Skipping
        // it avoids a warning for every pair of untranslated documents.
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
