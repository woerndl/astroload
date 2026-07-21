import type { PayloadRequest } from 'payload'

// Counts users so the response depends on a database round trip. The
// endpoint answers 503 when the CMS loses its database connection.
export async function getHealth(req: PayloadRequest): Promise<Response> {
  try {
    await req.payload.count({ collection: 'users', overrideAccess: true })
    return Response.json({ status: 'ok' })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'health endpoint failed')
    return Response.json({ status: 'error' }, { status: 503 })
  }
}
