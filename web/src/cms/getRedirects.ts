import { PayloadSDK } from '@payloadcms/sdk'
import type { RedirectConfig } from 'astro'
import 'dotenv/config'
import type { Config } from '@astroload/cms/src/payload-types'

import fallbackRedirects from './redirects.fallback.json'
import { stripLocalePath } from './types'

// Runs while Astro config is evaluated, before Vite loads .env, so astro:env
// is not available. dotenv/config loads .env into process.env for a plain
// `pnpm dev` or `pnpm build`.
//
// The `build` script sets REDIRECTS_STRICT=1. NODE_ENV does not work as the
// switch because astro check sets it to production and must not abort on a
// CMS outage. A strict build retries with backoff to cover a CMS restart
// during a coordinated deploy, then fails so the last good deploy keeps
// serving. Other runs make one attempt and then use redirects.fallback.json,
// which ships empty. See docs/astroload/maintenance.md.
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
      // Redirects have no localized `path`, so this read skips findPublicDocs.
      // A slug change records its redirect against the stored `/${locale}/...`
      // path, which a single-locale site does not serve, so both paths get the
      // locale strip. stripLocalePath leaves unprefixed paths unchanged.
      // This SDK instance bypasses cachedFetch and its timeout. Without the
      // signal a stalled connection holds this attempt and the retries do not
      // start.
      const result = await sdk.find(
        {
          collection: 'redirects',
          limit: 0,
          pagination: false,
        },
        { signal: AbortSignal.timeout(15_000) },
      )

      return result.docs.reduce<Record<string, RedirectConfig>>((acc, doc) => {
        acc[stripLocalePath(doc.sourcePath)] = {
          destination: stripLocalePath(doc.destinationPath),
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
