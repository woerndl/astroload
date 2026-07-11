import { getPayload } from 'payload'

import config from '../payload.config'
import { seedAuth } from '../seedAuth'

const payload = await getPayload({ config })

let exitCode = 0
try {
  await seedAuth(payload)
} catch (error) {
  payload.logger.error({ err: error }, 'Auth seed failed')
  exitCode = 1
} finally {
  await payload.destroy()
}
process.exit(exitCode)
