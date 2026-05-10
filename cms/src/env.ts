const required = ['PAYLOAD_SECRET', 'DATABASE_URI'] as const

type RequiredEnv = (typeof required)[number]

function loadEnv(): Record<RequiredEnv, string> {
  const missing: string[] = []
  const out = {} as Record<RequiredEnv, string>

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
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `See cms/.env.example for the full list.`,
    )
  }

  return out
}

export const env = loadEnv()
