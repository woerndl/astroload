const required = ['PAYLOAD_SECRET', 'DATABASE_URI'] as const

const withDefault = {
  // Used by generatePageURL.
  WEBSITE_URL: 'http://localhost:4321',
} as const

type RequiredEnv = (typeof required)[number]
type DefaultedEnv = keyof typeof withDefault
type LoadedEnv = Record<RequiredEnv, string> & Record<DefaultedEnv, string>

function loadEnv(): LoadedEnv {
  const missing: string[] = []
  const requiredValues: Partial<Record<RequiredEnv, string>> = {}

  for (const name of required) {
    const value = process.env[name]
    if (!value) {
      missing.push(name)
    } else {
      requiredValues[name] = value
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `See cms/.env.example for the full list.`,
    )
  }

  const defaultedValues = {} as Record<DefaultedEnv, string>
  for (const name of Object.keys(withDefault) as DefaultedEnv[]) {
    defaultedValues[name] = process.env[name] ?? withDefault[name]
  }

  return { ...(requiredValues as Record<RequiredEnv, string>), ...defaultedValues }
}

export const env = loadEnv()
