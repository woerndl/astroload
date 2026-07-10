import type { APIRoute } from 'astro'
import { UMAMI_WEBSITE_ID } from 'astro:env/client'
import { UMAMI_HOST_URL } from 'astro:env/server'

export const prerender = false

const COLLECT_URL = `${UMAMI_HOST_URL}/api/send`

// The only request headers forwarded upstream: the User-Agent (Cloud's
// server-side bot filter drops events whose UA was altered) and
// x-umami-cache (the session token the tracker echoes back). Everything else
// is dropped, so a visitor cannot spoof their geo through whatever header
// Umami's IP resolver might fall back to. x-umami-client-ip is synthesized
// from the proxy-trusted header below.
const FORWARD_HEADERS = ['user-agent', 'x-umami-cache']

// Umami Cloud rejects the whole event with a 400 when one optional payload
// field exceeds its length cap, so drop an overrunning capped field rather
// than lose the view. The caps are not publicly versioned. Re-check them on a
// major Umami update, and extend the map before sending custom events.
const FIELD_LIMITS: Record<string, number> = { language: 35, screen: 11 }

// Proxy Umami's collect endpoint from this origin, the second half of the
// content-blocker bypass. Two constraints, both verified against Umami Cloud:
// the visitor's IP must be forwarded as x-umami-client-ip (Cloud ignores
// x-forwarded-for and would otherwise pin every hit to the server's egress IP,
// collapsing visitor counts and geo), and the User-Agent must pass through
// untouched (an altered UA trips Cloud's server-side bot filter, which drops
// the event and still answers 200). A self-hosted Umami behind UMAMI_HOST_URL
// needs CLIENT_IP_HEADER=x-umami-client-ip set on the Umami server, or it
// falls back to the connection IP of this proxy.
export const POST: APIRoute = async ({ request }) => {
  if (!UMAMI_WEBSITE_ID) return new Response('', { status: 204 })

  // x-real-ip is the trusted client-IP header behind nginx-style proxies and
  // on Railway. A host that exposes the visitor IP under a different name
  // needs this read adjusted, or every visitor shares the proxy's IP. The
  // x-forwarded-for fallback reads the first hop, which the visitor controls
  // unless the proxy in front rewrites the header.
  const clientIp = request.headers.get('x-real-ip') ?? firstForwardedFor(request)

  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (clientIp) headers.set('x-umami-client-ip', clientIp)

  // The proxy relays events for this site only. Without the check it is an
  // open relay: anyone could funnel traffic for an arbitrary website id
  // through this origin, spending its egress and, on Umami Cloud, its event
  // quota. The tracker always posts { payload: { website } }, so a body
  // without this site's id is forged by construction.
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
    // A failed collect must stay invisible to the page: the tracker reads the
    // response inside a try/catch, so an empty 204 is silently ignored.
    return new Response('', { status: 204 })
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
