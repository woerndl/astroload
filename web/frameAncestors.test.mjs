import http from 'node:http'

import { afterEach, describe, expect, it } from 'vitest'

import { sendFrameAncestors } from './frameAncestors.mjs'

const POLICY = 'frame-ancestors https://cms.example.com'
let server

afterEach(() => server?.close())

async function cspFor(handler) {
  server = http.createServer((req, res) => {
    sendFrameAncestors(res, POLICY)
    handler(res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`)
  return res.headers.get('content-security-policy')
}

describe('sendFrameAncestors', () => {
  it('sends the policy on a response that sets no headers', async () => {
    expect(await cspFor((res) => res.end('ok'))).toBe(POLICY)
  })

  it('adds the policy after a Content-Security-Policy passed to writeHead', async () => {
    const csp = await cspFor((res) => {
      res.writeHead(200, { 'content-security-policy': "default-src 'self'" })
      res.end()
    })
    expect(csp).toBe(`default-src 'self', ${POLICY}`)
  })

  it('adds the policy after a Content-Security-Policy set with setHeader', async () => {
    const csp = await cspFor((res) => {
      res.setHeader('Content-Security-Policy', "default-src 'self'")
      res.end()
    })
    expect(csp).toBe(`default-src 'self', ${POLICY}`)
  })

  it('adds the policy after a Content-Security-Policy in a writeHead header array, with and without a status message', async () => {
    for (const write of [
      (res) => res.writeHead(200, ['Content-Security-Policy', "default-src 'self'"]),
      (res) => res.writeHead(200, 'OK', ['Content-Security-Policy', "default-src 'self'"]),
    ]) {
      const csp = await cspFor((res) => {
        write(res)
        res.end()
      })
      expect(csp).toBe(`default-src 'self', ${POLICY}`)
      server.close()
    }
  })

  it('adds the policy when writeHead receives the header name twice in different case', async () => {
    const csp = await cspFor((res) => {
      res.setHeader('Content-Type', 'text/html')
      res.writeHead(200, {
        'Content-Security-Policy': "default-src 'self'",
        'content-security-policy': "img-src 'self'",
      })
      res.end()
    })
    expect(csp).toBe(`img-src 'self', ${POLICY}`)
  })

  it('leaves a frozen headers object unchanged', async () => {
    const headers = Object.freeze({ 'Content-Security-Policy': "default-src 'self'" })
    const csp = await cspFor((res) => {
      res.writeHead(200, headers)
      res.end()
    })
    expect(csp).toBe(`default-src 'self', ${POLICY}`)
    expect(headers).toEqual({ 'Content-Security-Policy': "default-src 'self'" })
  })

  it('sends the policy when writeHead receives a status message and headers', async () => {
    const csp = await cspFor((res) => {
      res.writeHead(404, 'Not Found', { 'Content-Type': 'text/plain' })
      res.end()
    })
    expect(csp).toBe(POLICY)
  })
})
