import { randomBytes } from 'crypto'
import type { Payload } from 'payload'

const DEMO_ADMIN_EMAIL = 'admin@example.com'
const DEMO_ADMIN_PASSWORD = 'admin1234'

const generateApiKey = () => randomBytes(32).toString('hex')

// Creates the first admin and the two API keys (from PAYLOAD_READ_KEY and
// PAYLOAD_PREVIEW_KEY, generated when unset). It is separate from the demo
// content seed so a project can remove that seed and keep these. Without the
// keys every web read fails (401 from the custom endpoints, 403 from
// collection reads) and the strict build fails. Re-runs keep
// existing users and keys. The check and the create are not atomic, so two
// runs at once can create a duplicate admin or key.
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
