import type { LocalePaths } from './shared'
import { DEFAULT_LOCALE, LOCALE_URL_PREFIX } from './site-config'

// The pages-plugin always stores `path` as `/${locale}/...` while localization
// is active. Single-locale projects serve un-prefixed URLs, so this rewrites a
// stored path to its public form. It is a no-op in multi-locale mode and
// idempotent on an already-public path, so callers can apply it unconditionally.
export function stripLocalePath(path: string): string {
  if (LOCALE_URL_PREFIX) return path
  const prefix = `/${DEFAULT_LOCALE}`
  if (path === prefix) return '/'
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path
}

// Walk a populated document and rewrite every string `path` property to its
// public form, covering nav links, breadcrumbs, list-block items, and rich-text
// internal links. All of these carry the prefixed `path` the plugin emits.
// Returns the value untouched in multi-locale mode. Non-plain objects (Date and
// the like) pass through unchanged so serialization is unaffected. Input is
// assumed to be an acyclic JSON-serializable tree (it is always a Payload
// response that is about to be JSON-stringified), so the walk has no cycle guard.
export function stripLocalePathsDeep<T>(value: T): T {
  if (LOCALE_URL_PREFIX) return value
  return walk(value) as T
}

// Apply stripLocalePath across a per-locale path map.
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
