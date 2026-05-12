import { PayloadSDK } from '@payloadcms/sdk'
import type { RedirectConfig } from 'astro'
import 'dotenv/config'
import type { Config } from '@astroload/cms/src/payload-types'

// Runs while Astro config is evaluated, before Vite loads .env for app code,
// so astro:env is not available and process.env only sees what the shell
// exported. dotenv/config fills the gap so this works during a plain
// `pnpm dev` or `pnpm build`. Missing env (CI type-check, fresh checkout)
// returns an empty redirect table instead of failing the build.
export async function getRedirects(): Promise<Record<string, RedirectConfig>> {
  const cmsUrl = process.env.CMS_URL
  const apiKey = process.env.PAYLOAD_READ_KEY
  if (!cmsUrl || !apiKey) {
    console.warn('[getRedirects] CMS_URL or PAYLOAD_READ_KEY not set, skipping redirects fetch')
    return {}
  }

  const sdk = new PayloadSDK<Config>({
    baseURL: new URL('/api', cmsUrl).toString(),
    baseInit: {
      headers: { Authorization: `api-keys API-Key ${apiKey}` },
    },
  })

  const result = await sdk.find({
    collection: 'redirects',
    limit: 0,
    pagination: false,
  })

  return result.docs.reduce<Record<string, RedirectConfig>>((acc, doc) => {
    acc[doc.sourcePath] = {
      destination: doc.destinationPath,
      status: doc.type === 'permanent' ? 301 : 302,
    }
    return acc
  }, {})
}
