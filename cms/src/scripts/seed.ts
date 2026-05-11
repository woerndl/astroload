import { getPayload } from 'payload'

import config from '../payload.config'
import { seedCMS } from '../seed'

const force = process.argv.includes('--force') || process.env.SEED_FORCE === '1'

const payload = await getPayload({ config })

let exitCode = 0
try {
  await seedCMS(payload, force)
} catch (error) {
  payload.logger.error({ err: error }, 'Seed failed')
  exitCode = 1
} finally {
  await payload.destroy()
}
process.exit(exitCode)
