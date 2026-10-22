import { CMS_URL, WEBSITE_URL } from 'astro:env/client'

export function absoluteSiteURL(path: string): string {
  return new URL(path, WEBSITE_URL).toString()
}

export function absoluteCmsURL(path: string): string {
  return new URL(path, CMS_URL).toString()
}

// Media files carry a long-lived Cache-Control, so media URLs get a
// ?v=updatedAt marker when the doc has one. A changed file gets a new URL,
// which bypasses stale CDN and browser caches.
export function versionedMediaURL(path: string, updatedAt?: string | null): string {
  const url = new URL(path, CMS_URL)
  const version = updatedAt ? Date.parse(updatedAt) : NaN
  if (!Number.isNaN(version)) url.searchParams.set('v', String(version))
  return url.toString()
}
