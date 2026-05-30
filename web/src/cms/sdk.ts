import { PayloadSDK } from '@payloadcms/sdk'
import { PAYLOAD_READ_KEY } from 'astro:env/server'
import type { Config } from '@astroload/cms/src/payload-types'

import { createCachedFetch } from './sdk/cachedFetch'
import { absoluteCmsURL } from './urls'

export function createPayloadSDK(apiKey: string): PayloadSDK<Config> {
  return new PayloadSDK<Config>({
    baseURL: absoluteCmsURL('/api'),
    baseInit: {
      headers: { Authorization: `api-keys API-Key ${apiKey}` },
    },
    fetch: createCachedFetch(globalThis.fetch),
  })
}

export const payloadSDK = createPayloadSDK(PAYLOAD_READ_KEY)
