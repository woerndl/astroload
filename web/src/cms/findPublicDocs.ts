import { payloadSDK } from './sdk'
import { stripLocalePathsDeep } from './types'

type FindParams = Parameters<typeof payloadSDK.find>

// Single seam for reading public, localized documents. It strips the locale
// path prefix from every returned doc, so a new read helper cannot ship a
// prefixed `path` by forgetting to strip. Reads with no localized `path`
// (e.g. redirects) call payloadSDK.find directly and skip the strip on purpose.
export async function findPublicDocs(...args: FindParams) {
  const result = await payloadSDK.find(...args)
  return stripLocalePathsDeep(result)
}
