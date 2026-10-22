import type { APIRoute } from 'astro'
import { UMAMI_WEBSITE_ID } from 'astro:env/client'
import { UMAMI_HOST_URL } from 'astro:env/server'

export const prerender = false

const TRACKER_URL = `${UMAMI_HOST_URL}/script.js`

// Refetch the tracker at most this often and serve it from memory in between.
// On a failed refetch the cached copy keeps serving.
const TRACKER_TTL_MS = 15 * 60 * 1000
let cachedScript = ''
let fetchedAt = 0

// Serves Umami's tracker from this origin so content blockers that match the
// Umami hosts do not block it. The tag's data-host-url="/" sends events to the
// /api/send proxy (see Umami.astro).
export const GET: APIRoute = async () => {
  if (!UMAMI_WEBSITE_ID) return script('')

  if (!cachedScript || Date.now() - fetchedAt > TRACKER_TTL_MS) {
    try {
      const upstream = await fetch(TRACKER_URL)
      if (upstream.ok) cachedScript = await upstream.text()
    } catch {
      // A failed fetch must not break the page, so serve the cached copy, or an
      // empty script when nothing has been fetched yet.
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
