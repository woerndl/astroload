import type { APIRoute } from 'astro'
import { UMAMI_WEBSITE_ID } from 'astro:env/client'
import { UMAMI_HOST_URL } from 'astro:env/server'

export const prerender = false

const COLLECT_URL = `${UMAMI_HOST_URL}/api/send`

// Only these request headers go upstream: the User-Agent, because Umami Cloud's
// bot filter drops events with an altered UA, and x-umami-cache, the session
// token the tracker echoes back. Dropping the rest stops a visitor from
// spoofing their geo through a header Umami's IP lookup might fall back to.
const FORWARD_HEADERS = ['user-agent', 'x-umami-cache']

// Umami Cloud rejects the whole event with a 400 when one optional payload
// field exceeds its length cap, so a field over its cap is dropped to keep the
// pageview. The caps are not publicly versioned. Re-check them on a major
// Umami update, and extend the map before sending custom events.
const FIELD_LIMITS: Record<string, number> = { language: 35, screen: 11 }

// Proxies Umami's collect endpoint from this origin. Umami Cloud ignores
// x-forwarded-for, so the visitor IP goes in x-umami-client-ip. Without it
// every event carries the server's egress IP, which collapses visitor counts
// and geo. An altered User-Agent trips Cloud's bot filter, which drops the
// event and still answers 200. A self-hosted Umami behind UMAMI_HOST_URL needs
// CLIENT_IP_HEADER=x-umami-client-ip on the Umami server, or it records the
// IP of this proxy.
export const POST: APIRoute = async ({ request }) => {
  if (!UMAMI_WEBSITE_ID) return new Response(null, { status: 204 })

  // x-real-ip is the trusted client IP header behind nginx and on Railway. A
  // host that exposes the visitor IP under a different name needs this read
  // adjusted, or every visitor shares the proxy's IP. The
  // x-forwarded-for fallback reads the first hop, which the visitor controls
  // unless the proxy in front rewrites the header.
  const clientIp = request.headers.get('x-real-ip') ?? firstForwardedFor(request)

  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (clientIp) headers.set('x-umami-client-ip', clientIp)

  // Relay events for this site only. Otherwise anyone could send events for
  // any website id through this origin and spend its egress and, on Umami
  // Cloud, its event quota. The tracker always posts { payload: { website } },
  // so a body without this site's id is forged.
  const raw = await request.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return new Response('', { status: 403 })
  }
  const payload = (parsed as { payload?: { website?: unknown } } | null)?.payload
  if (payload?.website !== UMAMI_WEBSITE_ID) {
    return new Response('', { status: 403 })
  }

  const body = pruneOverlongFields(parsed, raw)

  try {
    const upstream = await fetch(COLLECT_URL, { method: 'POST', headers, body })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'text/plain' },
    })
  } catch {
    // The tracker reads the response inside a try/catch and ignores an empty
    // 204, so a failed upstream call does not reach the page.
    return new Response(null, { status: 204 })
  }
}

function firstForwardedFor(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for')
  return xff ? (xff.split(',')[0]?.trim() ?? null) : null
}

function pruneOverlongFields(parsed: unknown, raw: string): string {
  const payload = (parsed as { payload?: Record<string, unknown> } | null)?.payload
  if (!payload || typeof payload !== 'object') return raw

  let pruned = false
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    const value = payload[field]
    if (typeof value === 'string' && value.length > max) {
      delete payload[field]
      pruned = true
    }
  }
  return pruned ? JSON.stringify(parsed) : raw
}
