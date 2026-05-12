import { PayloadSDK } from '@payloadcms/sdk'
import type { RedirectConfig } from 'astro'
import 'dotenv/config'
import type { Config } from '@astroload/cms/src/payload-types'

// Runs while Astro config is evaluated, before Vite loads .env for app code,
// so astro:env is not available and process.env only sees what the shell
// exported. dotenv/config fills the gap for a plain `pnpm dev` or `pnpm build`.
//
// Failure modes:
//   - missing env during a production build: throw, so the deploy aborts loudly
//     instead of shipping a site with an empty redirect table.
//   - missing env in dev or CI type-check: return {} silently, no warning.
//   - CMS unreachable or fetch errored: warn and return {} so the build still
//     ships. Editors lose redirect changes until the next successful build.
export async function getRedirects(): Promise<Record<string, RedirectConfig>> {
  const cmsUrl = process.env.CMS_URL
  const apiKey = process.env.PAYLOAD_READ_KEY
  if (!cmsUrl || !apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[getRedirects] CMS_URL and PAYLOAD_READ_KEY are required for production builds',
      )
    }
    return {}
  }

  const sdk = new PayloadSDK<Config>({
    baseURL: new URL('/api', cmsUrl).toString(),
    baseInit: {
      headers: { Authorization: `api-keys API-Key ${apiKey}` },
    },
  })

  try {
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
  } catch (err) {
    console.warn('[getRedirects] CMS fetch failed, shipping build without redirects:', err)
    return {}
  }
}
