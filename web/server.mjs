// Production entry. The node adapter sends plain responses, so a host
// without edge compression serves every page uncompressed, this wrapper
// adds gzip/brotli.
//
// `ASTRO_NODE_AUTOSTART=disabled` keeps the standalone entry from binding
// its own listener, so this reuses its handler (which still owns all
// routing, including the immutable /_astro/* cache) and only adds
// compression. Plain HTTP only: the adapter's SERVER_CERT_PATH/
// SERVER_KEY_PATH TLS mode is not reproduced here, TLS belongs in the
// proxy in front (see docs/astroload/deployment.md).
process.env.ASTRO_NODE_AUTOSTART = 'disabled'

import http from 'node:http'

import compression from 'compression'

const { handler } = await import('./dist/server/entry.mjs')
const compress = compression({
  // Range answers describe byte offsets into the uncompressed file, so
  // transforming them would corrupt resumed downloads.
  filter: (req, res) =>
    res.statusCode !== 206 && !res.getHeader('Content-Range') && compression.filter(req, res),
})

// Default only when PORT is unset, so PORT=0 stays 0 and a malformed
// value fails in listen() instead of binding 4321 unnoticed.
const port = process.env.PORT ? Number(process.env.PORT) : 4321
const host = process.env.HOST || '0.0.0.0'

const server = http.createServer((req, res) => {
  compress(req, res, () => handler(req, res))
})
server.listen(port, host, () => {
  // Same switch the adapter's own standalone startup honors.
  if (process.env.ASTRO_NODE_LOGGING !== 'disabled') {
    console.log(`web listening on ${host}:${server.address().port}`)
  }
})
