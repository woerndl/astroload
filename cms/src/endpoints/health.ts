import type { PayloadRequest } from 'payload'

// Counts users so the check fails with 503 when the database is unreachable.
export async function getHealth(req: PayloadRequest): Promise<Response> {
  try {
    await req.payload.count({ collection: 'users', overrideAccess: true })
    return Response.json({ status: 'ok' })
  } catch (error) {
    req.payload.logger.error({ err: error }, 'health endpoint failed')
    return Response.json({ status: 'error' }, { status: 503 })
  }
}
