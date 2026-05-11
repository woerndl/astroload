const required = ['PAYLOAD_SECRET', 'DATABASE_URI', 'SERVER_URL', 'WEBSITE_URL'] as const

type RequiredEnv = (typeof required)[number]
type LoadedEnv = Record<RequiredEnv, string>

function loadEnv(): LoadedEnv {
  const missing: string[] = []
  const out: Partial<Record<RequiredEnv, string>> = {}

  for (const name of required) {
    const value = process.env[name]
    if (!value) {
      missing.push(name)
    } else {
      out[name] = value
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See cms/.env.example for the full list.`,
    )
  }

  return out as LoadedEnv
}

export const env = loadEnv()
