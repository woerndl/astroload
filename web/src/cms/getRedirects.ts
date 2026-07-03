import { PayloadSDK } from '@payloadcms/sdk'
import type { RedirectConfig } from 'astro'
import 'dotenv/config'
import type { Config } from '@astroload/cms/src/payload-types'

import fallbackRedirects from './redirects.fallback.json'

// Runs while Astro config is evaluated, before Vite loads .env for app code,
// so astro:env is not available and process.env only sees what the shell
// exported. dotenv/config fills the gap for a plain `pnpm dev` or `pnpm build`.
//
// Strictness is keyed on REDIRECTS_STRICT, set by the `build` script, not on
// NODE_ENV: astro check forces NODE_ENV=production while resolving the config
// and must not abort on a temporary CMS outage. Failure modes:
//   - REDIRECTS_STRICT=1 (the deploy build): a failed fetch is retried with
//     backoff to ride out a CMS that is briefly down during a coordinated
//     deploy. If it is still unreachable after the retries, the build fails
//     loudly rather than shipping a redirect-less site over the last good
//     deploy that is already serving. A missing CMS_URL/PAYLOAD_READ_KEY throws
//     the same way. The CMS is trusted when it answers, so an empty collection
//     produces an empty table.
//   - otherwise (dev, astro check, plain astro build): one attempt, then the
//     committed fallback so the run still ships. Editors lose redirect changes
//     until the next strict build.
//
// redirects.fallback.json is the committed redirect table for non-strict runs
// (offline dev and CI). It ships empty. An operator who would rather keep a
// deploy alive through a CMS outage than fail it can return `fallback` instead
// of throwing in the strict branch below, after populating that file by
// exporting the redirects collection into it.
const STRICT_MAX_ATTEMPTS = 6
const fallback = fallbackRedirects as Record<string, RedirectConfig>

function backoffMs(attempt: number): number {
  return Math.min(30_000, 5_000 * 2 ** (attempt - 1))
}

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
    return fallback
  }

  const sdk = new PayloadSDK<Config>({
    baseURL: new URL('/api', cmsUrl).toString(),
    baseInit: {
      headers: { Authorization: `api-keys API-Key ${apiKey}` },
    },
  })

  const maxAttempts = strict ? STRICT_MAX_ATTEMPTS : 1
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      lastError = err
      if (attempt < maxAttempts) {
        const wait = backoffMs(attempt)
        console.warn(
          `[getRedirects] CMS fetch failed (attempt ${attempt}/${maxAttempts}), retrying in ${wait}ms`,
        )
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
    }
  }

  // Out of attempts. A coordinated cms+web deploy can leave the CMS briefly
  // unreachable while it restarts; the retries above cover that gap. A longer
  // outage on a strict build fails loudly, which leaves the last good deploy
  // serving rather than replacing it with a redirect-less build. Non-strict runs
  // fall back to the committed table so dev and CI still ship.
  if (strict) {
    throw new Error(
      '[getRedirects] CMS unreachable after retries during a strict build; refusing to ' +
        'ship without redirects. Original error: ' +
        (lastError instanceof Error ? lastError.message : String(lastError)),
      { cause: lastError },
    )
  }
  console.warn('[getRedirects] CMS fetch failed, using the committed fallback:', lastError)
  return fallback
}
