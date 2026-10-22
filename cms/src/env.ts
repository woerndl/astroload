const required = [
  'PAYLOAD_SECRET',
  'DATABASE_URI',
  'SERVER_URL',
  'WEBSITE_URL',
  'PREVIEW_SECRET',
] as const

const optional = [
  'DEPLOY_HOOK_URL',
  'DEPLOY_HOOK_BODY',
  'DEPLOY_HOOK_HEADERS',
  'DEPLOY_RAILWAY_TOKEN',
  'DEPLOY_RAILWAY_SERVICE_ID',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_ENVIRONMENT_ID',
] as const

type RequiredEnv = (typeof required)[number]
type OptionalEnv = (typeof optional)[number]
type LoadedEnv = Record<RequiredEnv, string> & Partial<Record<OptionalEnv, string>>

// CI and the Docker build have no secrets and set SKIP_ENV_VALIDATION. Only
// '1' or 'true' skips the check. CI=true alone does not.
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true'

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
