const required = [
  'PAYLOAD_SECRET',
  'DATABASE_URI',
  'SERVER_URL',
  'WEBSITE_URL',
  'PREVIEW_SECRET',
] as const

const optional = ['DEPLOY_HOOK_URL'] as const

type RequiredEnv = (typeof required)[number]
type OptionalEnv = (typeof optional)[number]
type LoadedEnv = Record<RequiredEnv, string> & Partial<Record<OptionalEnv, string>>

// Skip the required-vars check in CI lint/typecheck, where secrets are absent.
// Explicit opt-in only, so a stray CI=true or SKIP_ENV_VALIDATION=0 never
// disables validation without warning in a real deployment.
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === '1' ||
  process.env.SKIP_ENV_VALIDATION === 'true' ||
  process.env.CI === 'true'

function loadEnv(): LoadedEnv {
  const missing: string[] = []
  const out: Partial<LoadedEnv> = {}

  for (const name of required) {
    const value = process.env[name]
    if (!value) {
      missing.push(name)
    } else {
      out[name] = value
    }
  }

  if (missing.length > 0 && !skipValidation) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See cms/.env.example for the full list.`,
    )
  }

  for (const name of optional) {
    const value = process.env[name]
    if (value) out[name] = value
  }

  return out as LoadedEnv
}

export const env = loadEnv()
