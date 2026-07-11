import { randomBytes } from 'crypto'
import type { Payload } from 'payload'

const DEMO_ADMIN_EMAIL = 'admin@example.com'
const DEMO_ADMIN_PASSWORD = 'admin1234'

const generateApiKey = () => randomBytes(32).toString('hex')

// Auth bootstrap, deliberately separate from the demo-content seed: a fresh
// database needs the first admin and the two env-pinned API keys even after a
// project deletes the demo seed, or every web read answers 403 and the strict
// build fails. Re-runs skip whatever already exists, so it is safe on top of
// a live database. The check-then-create is not atomic (transactions are off
// on standalone Mongo), so two bootstraps racing could double-mint a key,
// the same window as the documented first-user race. Run one at a time.
export async function seedAuth(payload: Payload): Promise<void> {
  const users = await payload.find({ collection: 'users', limit: 1, pagination: false })
  if (users.totalDocs === 0) {
    const email = process.env.PAYLOAD_ADMIN_EMAIL ?? DEMO_ADMIN_EMAIL
    const password = process.env.PAYLOAD_ADMIN_PASSWORD ?? DEMO_ADMIN_PASSWORD
    if (email === DEMO_ADMIN_EMAIL || password === DEMO_ADMIN_PASSWORD) {
      payload.logger.warn(
        'Seed: creating the admin with demo credentials. Set PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD, or change the account before the instance is reachable.',
      )
    }
    payload.logger.info('Seed: creating admin user')
    await payload.create({
      collection: 'users',
      data: { email, password, firstName: 'Admin', lastName: 'User', roles: ['admin'] },
    })
  }

  const keySpecs = [
    { name: 'Website (read-only)', type: 'read-only', env: 'PAYLOAD_READ_KEY' },
    { name: 'Preview', type: 'preview', env: 'PAYLOAD_PREVIEW_KEY' },
  ] as const

  for (const spec of keySpecs) {
    const existing = await payload.find({
      collection: 'api-keys',
      where: { type: { equals: spec.type } },
      limit: 1,
      pagination: false,
    })
    if (existing.totalDocs > 0) continue
    const value = process.env[spec.env] ?? generateApiKey()
    await payload.create({
      collection: 'api-keys',
      data: { name: spec.name, type: spec.type, enableAPIKey: true, apiKey: value },
    })
    payload.logger.info(`Seed: ${spec.type} api key = ${value}`)
  }
}
