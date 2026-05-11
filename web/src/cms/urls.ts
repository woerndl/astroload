import { CMS_URL, WEBSITE_URL } from 'astro:env/client'

export function absoluteSiteURL(path: string): string {
  return new URL(path, WEBSITE_URL).toString()
}

export function absoluteCmsURL(path: string): string {
  return new URL(path, CMS_URL).toString()
}
