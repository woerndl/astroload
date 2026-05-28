import { PayloadSDK } from '@payloadcms/sdk'
import type { RedirectConfig } from 'astro'
import 'dotenv/config'
import type { Config } from '@astroload/cms/src/payload-types'

// Runs while Astro config is evaluated, before Vite loads .env for app code,
// so astro:env is not available and process.env only sees what the shell
// exported. dotenv/config fills the gap for a plain `pnpm dev` or `pnpm build`.
//
// Strictness is keyed on REDIRECTS_STRICT, set by the `build` script, not on
// NODE_ENV: astro check forces NODE_ENV=production while resolving the config
// and must not abort on a CMS blip. Failure modes:
//   - REDIRECTS_STRICT=1 (the deploy build): a missing CMS_URL/PAYLOAD_READ_KEY
//     or a failed CMS fetch throws, so the deploy aborts loudly instead of
//     shipping a site with an empty redirect table.
//   - otherwise (dev, astro check, plain astro build): a missing env var
//     returns {} silently, and a failed fetch warns and returns {} so the run
//     still ships. Editors lose redirect changes until the next strict build.
export async function getRedirects(): Promise<Record<string, RedirectConfig>> {
  const cmsUrl = process.env.CMS_URL
  const apiKey = process.env.PAYLOAD_READ_KEY
  const strict = process.env.REDIRECTS_STRICT === '1'
  if (!cmsUrl || !apiKey) {
    if (strict) {
      throw new Error(
        '[getRedirects] CMS_URL and PAYLOAD_READ_KEY are required for a strict build (REDIRECTS_STRICT=1)',
      )
    }
    return {}
  }

  try {
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
  } catch (err) {
    if (strict) {
      throw new Error(
        '[getRedirects] CMS fetch failed during a strict build; refusing to ship ' +
          'without redirects. Original error: ' +
          (err instanceof Error ? err.message : String(err)),
        { cause: err },
      )
    }
    console.warn('[getRedirects] CMS fetch failed, shipping build without redirects:', err)
    return {}
  }
}
