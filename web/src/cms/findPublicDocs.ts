import { payloadSDK } from './sdk'
import { stripLocalePathsDeep } from './types'

type FindParams = Parameters<typeof payloadSDK.find>

// Reads public, localized documents and strips the locale path prefix from
// every returned doc, so a new read helper does not return a prefixed `path`.
// Reads without a localized `path` (e.g. redirects) call payloadSDK.find
// directly.
export async function findPublicDocs(...args: FindParams) {
  const result = await payloadSDK.find(...args)
  return stripLocalePathsDeep(result)
}
