import { CMS_URL, WEBSITE_URL } from 'astro:env/client'

export function absoluteSiteURL(path: string): string {
  return new URL(path, WEBSITE_URL).toString()
}

export function absoluteCmsURL(path: string): string {
  return new URL(path, CMS_URL).toString()
}

// Media files carry a long-lived Cache-Control, so media urls get a
// ?v=updatedAt marker, when the doc provides one, that changes when the file
// does. A stale CDN or browser
// cache is bypassed because the changed file produces a different url.
export function versionedMediaURL(path: string, updatedAt?: string | null): string {
  const url = new URL(path, CMS_URL)
  const version = updatedAt ? Date.parse(updatedAt) : NaN
  if (!Number.isNaN(version)) url.searchParams.set('v', String(version))
  return url.toString()
}
