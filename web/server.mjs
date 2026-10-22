// Production entry. The node adapter sends uncompressed responses, so this
// wrapper adds gzip and brotli around the adapter's handler, which still does
// all routing and the immutable /_astro/* caching.
// `ASTRO_NODE_AUTOSTART=disabled` stops the standalone entry from opening its
// own listener. The adapter's SERVER_CERT_PATH and SERVER_KEY_PATH TLS mode is
// not supported here, so TLS belongs in the proxy in front (see
// docs/astroload/deployment.md).
process.env.ASTRO_NODE_AUTOSTART = 'disabled'

import http from 'node:http'

import compression from 'compression'

import { aliasRedirect } from './aliasRedirect.mjs'
import { sendFrameAncestors } from './frameAncestors.mjs'

const { handler } = await import('./dist/server/entry.mjs')
const compress = compression({
  // Range answers describe byte offsets into the uncompressed file, so
  // transforming them would corrupt resumed downloads.
  filter: (req, res) =>
    res.statusCode !== 206 && !res.getHeader('Content-Range') && compression.filter(req, res),
})

// Astro middleware does not run for prerendered pages, so this server runs
// the alias redirect and sends the frame-ancestors header. A <meta> policy
// cannot carry frame-ancestors. The header allows framing only from the CMS
// origin, which the admin live preview needs.
const redirect = aliasRedirect(process.env)
if (!process.env.CMS_URL) throw new Error('CMS_URL is required for the frame-ancestors header')
const frameAncestors = `frame-ancestors ${new URL(process.env.CMS_URL).origin}`

// Default only when PORT is unset, so PORT=0 stays 0 and a malformed
// value fails in listen() instead of binding 4321 unnoticed.
const port = process.env.PORT ? Number(process.env.PORT) : 4321
const host = process.env.HOST || '0.0.0.0'

const server = http.createServer((req, res) => {
  sendFrameAncestors(res, frameAncestors)
  // Astro drops the preview route's own Referrer-Policy when it renders a
  // thrown error, so this sets it for every request with previewSecret in its
  // query. URLSearchParams decodes the name and does not throw.
  const queryStart = req.url?.indexOf('?') ?? -1
  if (
    queryStart !== -1 &&
    new URLSearchParams(req.url?.slice(queryStart + 1)).has('previewSecret')
  ) {
    res.setHeader('Referrer-Policy', 'no-referrer')
  }
  const target = redirect?.(req.headers['x-forwarded-host'], req.url)
  if (target) {
    res.writeHead(target.status, { Location: target.location })
    res.end()
    return
  }
  compress(req, res, () => handler(req, res))
})
server.listen(port, host, () => {
  // Same switch the adapter's own standalone startup honors.
  if (process.env.ASTRO_NODE_LOGGING !== 'disabled') {
    console.log(`web listening on ${host}:${server.address().port}`)
  }
})
