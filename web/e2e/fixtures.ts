import { readFileSync } from 'node:fs'
import http from 'node:http'

import {
  test as base,
  expect,
  request,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test'
import { parse } from 'dotenv'

export const webEnv = parse(readFileSync(new URL('../.env', import.meta.url)))
const cmsEnv = parse(readFileSync(new URL('../../cms/.env', import.meta.url)))

export const env = {
  cmsUrl: webEnv.CMS_URL || 'http://localhost:3000',
  websiteUrl: webEnv.WEBSITE_URL || 'http://localhost:4321',
  readKey: webEnv.PAYLOAD_READ_KEY ?? '',
  previewKey: webEnv.PAYLOAD_PREVIEW_KEY ?? '',
  previewSecret: webEnv.PREVIEW_SECRET ?? '',
  umamiWebsiteId: webEnv.UMAMI_WEBSITE_ID ?? '',
  umamiHostUrl: webEnv.UMAMI_HOST_URL ?? '',
  contentBuildId: webEnv.CONTENT_BUILD_ID ?? '',
  deployHookUrl: cmsEnv.DEPLOY_HOOK_URL ?? '',
}

// The admin the auth seed creates. The demo values apply when the seed ran
// with PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD unset.
export const ADMIN = {
  email: cmsEnv.PAYLOAD_ADMIN_EMAIL ?? 'admin@example.com',
  password: cmsEnv.PAYLOAD_ADMIN_PASSWORD ?? 'admin1234',
}

export const readKey = { Authorization: `api-keys API-Key ${env.readKey}` }
export const previewKey = { Authorization: `api-keys API-Key ${env.previewKey}` }

// Logs in through a throwaway context, because a login response sets a session
// cookie that would authenticate every later request on a shared context.
export async function login(email: string, password: string) {
  const ctx = await request.newContext({ baseURL: env.cmsUrl })
  const res = await ctx.post('/api/users/login', { data: { email, password } })
  await expect(res).toBeOK()
  const { token } = await res.json()
  await ctx.dispose()
  return { Authorization: `JWT ${token}` }
}

// Runs when the Playwright config loads, so a missing key or secret, or a
// PREVIEW_SECRET mismatch, stops the run before the web build.
export function preflight() {
  const missing = ['PAYLOAD_READ_KEY', 'PAYLOAD_PREVIEW_KEY', 'PREVIEW_SECRET'].filter(
    (name) => !webEnv[name],
  )
  if (missing.length) {
    throw new Error(
      `web/.env is missing ${missing.join(', ')}. Copy the API key values the auth seed logs, and PREVIEW_SECRET from cms/.env.`,
    )
  }
  if (env.previewSecret !== cmsEnv.PREVIEW_SECRET)
    throw new Error('PREVIEW_SECRET differs between web/.env and cms/.env')
}

type Received = { method: string; url: string; headers: http.IncomingHttpHeaders; body: string }

type Fixtures = {
  web: APIRequestContext
  // Runs each function after the test, the last one first, and fails the test
  // when one throws or returns a response with an error status.
  cleanup: (fn: () => Promise<unknown>) => void
  // Starts a server on a loopback URL and records every request it gets. Tests
  // point the deploy webhook and the analytics relay at it. It answers 200
  // "ok", which the relay passes through.
  receiver: (url: string) => Promise<{ requests: Received[]; url: URL }>
}

export const test = base.extend<Fixtures, { cms: APIRequestContext; admin: APIRequestContext }>({
  cms: [
    async ({ playwright }, use) => {
      const ctx = await playwright.request.newContext({ baseURL: env.cmsUrl })
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],
  admin: [
    async ({ playwright }, use) => {
      const extraHTTPHeaders = await login(ADMIN.email, ADMIN.password)
      const ctx = await playwright.request.newContext({ baseURL: env.cmsUrl, extraHTTPHeaders })
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],
  web: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: env.websiteUrl, maxRedirects: 0 })
    await use(ctx)
    await ctx.dispose()
  },
  // Playwright parses the first parameter's destructuring pattern to find
  // fixture dependencies, so it stays `{}`.
  // eslint-disable-next-line no-empty-pattern
  cleanup: async ({}, use) => {
    const fns: (() => Promise<unknown>)[] = []
    await use((fn) => void fns.push(fn))
    const failures: unknown[] = []
    for (const fn of fns.reverse()) {
      const result = await fn().catch((err) => failures.push(err))
      if (result instanceof Object && 'ok' in result && !(result as APIResponse).ok()) {
        const res = result as APIResponse
        failures.push(new Error(`cleanup ${res.url()} answered ${res.status()}`))
      }
    }
    if (failures.length) throw failures[0]
  },
  receiver: async ({ cleanup }, use) => {
    await use(async (value) => {
      const url = new URL(value)
      test.skip(
        url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || !url.port,
        `${value} is not a loopback http URL with a port`,
      )
      const requests: Received[] = []
      const server = http.createServer((req, res) => {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          requests.push({
            method: req.method ?? '',
            url: req.url ?? '',
            headers: req.headers,
            body,
          })
          res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
        })
      })
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(Number(url.port), '127.0.0.1', resolve)
      })
      cleanup(() => new Promise<void>((resolve) => server.close(() => resolve())))
      return { requests, url }
    })
  },
})

export { expect }
