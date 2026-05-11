import { PAYLOAD_PREVIEW_KEY } from 'astro:env/server'

import { createPayloadSDK } from './sdk'

export const previewPayloadSDK = createPayloadSDK(PAYLOAD_PREVIEW_KEY)
