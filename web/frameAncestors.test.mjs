import http from 'node:http'

import { expect, it } from 'vitest'

import { sendFrameAncestors } from './frameAncestors.mjs'

const POLICY = 'frame-ancestors https://cms.example.com'
const OWN = "default-src 'self'"

// prettier-ignore
it.each([
  ['sets no headers', (res) => res.end(), POLICY],
  ['writes a status message', (res) => res.writeHead(404, 'Not Found').end(), POLICY],
  ['passes its CSP to writeHead', (res) => res.writeHead(200, { 'content-security-policy': OWN }).end(), `${OWN}, ${POLICY}`],
  ['sets its CSP with setHeader', (res) => res.setHeader('Content-Security-Policy', OWN).end(), `${OWN}, ${POLICY}`],
  ['passes a header array', (res) => res.writeHead(200, ['Content-Security-Policy', OWN]).end(), `${OWN}, ${POLICY}`],
  ['passes a status message and a header array', (res) => res.writeHead(200, 'OK', ['Content-Security-Policy', OWN]).end(), `${OWN}, ${POLICY}`],
  ['passes a frozen headers object', (res) => res.writeHead(200, Object.freeze({ 'Content-Security-Policy': OWN })).end(), `${OWN}, ${POLICY}`],
  ['passes the header name twice in different case', (res) => res.writeHead(200, { 'Content-Security-Policy': OWN, 'content-security-policy': "img-src 'self'" }).end(), `img-src 'self', ${POLICY}`],
])('adds the policy when the response %s', async (_, handler, expected) => {
  const server = http.createServer((_, res) => {
    sendFrameAncestors(res, POLICY)
    handler(res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/`)
    expect(res.headers.get('content-security-policy')).toBe(expected)
  } finally {
    server.close()
  }
})
