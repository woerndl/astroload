import type { APIRoute } from 'astro'
import { UMAMI_WEBSITE_ID } from 'astro:env/client'
import { UMAMI_HOST_URL } from 'astro:env/server'

export const prerender = false

const TRACKER_URL = `${UMAMI_HOST_URL}/script.js`

// Refetch the tracker at most this often. Between fetches every request is
// served from memory. On a failed refetch the cached copy keeps serving, so an
// upstream outage costs nothing once one fetch has succeeded.
const TRACKER_TTL_MS = 15 * 60 * 1000
let cachedScript = ''
let fetchedAt = 0

// Serve Umami's tracker from this origin so a content blocker keyed on the
// Umami hosts cannot strip it. Collect requests are routed through the
// /api/send proxy by data-host-url="/" on the tag (see Umami.astro).
export const GET: APIRoute = async () => {
  if (!UMAMI_WEBSITE_ID) return script('')

  if (!cachedScript || Date.now() - fetchedAt > TRACKER_TTL_MS) {
    try {
      const upstream = await fetch(TRACKER_URL)
      if (upstream.ok) cachedScript = await upstream.text()
    } catch {
      // A failed fetch must never break the page: fall through to the cached
      // copy, or to an empty script when nothing has been fetched yet.
    }
    fetchedAt = Date.now()
  }
  return script(cachedScript)
}

function script(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': body ? 'public, max-age=14400' : 'public, max-age=300',
    },
  })
}
