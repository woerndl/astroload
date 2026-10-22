import type { LocalePaths } from './shared'
import { DEFAULT_LOCALE, LOCALE_URL_PREFIX } from './site-config'

// The pages plugin stores `path` as `/${locale}/...` while localization is on.
// When LOCALE_URL_PREFIX is off the site serves un-prefixed URLs, so this
// rewrites a stored path to its public form. It returns the path unchanged
// when LOCALE_URL_PREFIX is on or the path is already public.
export function stripLocalePath(path: string): string {
  if (LOCALE_URL_PREFIX) return path
  const prefix = `/${DEFAULT_LOCALE}`
  if (path === prefix) return '/'
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path
}

// Rewrites every string `path` property in a populated document to its public
// form: nav links, breadcrumbs, list block items, and rich-text internal links.
// Non-plain objects such as Date pass through. The input is a Payload response
// about to be serialized to JSON, so it has no cycles and the walk has no
// cycle guard.
export function stripLocalePathsDeep<T>(value: T): T {
  if (LOCALE_URL_PREFIX) return value
  return walk(value) as T
}

export function toPublicPaths(paths: LocalePaths): LocalePaths {
  if (LOCALE_URL_PREFIX) return paths
  const out: LocalePaths = {}
  for (const [code, value] of Object.entries(paths) as [keyof LocalePaths, string | undefined][]) {
    out[code] = value ? stripLocalePath(value) : value
  }
  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walk)
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = key === 'path' && typeof val === 'string' ? stripLocalePath(val) : walk(val)
    }
    return out
  }
  return value
}
