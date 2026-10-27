import type { CollectionAfterChangeHook } from 'payload'

import { afterEach, expect, it, vi } from 'vitest'

const HOOK_URL = 'https://deploy.example.com/hook'
const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const RAILWAY_ENV = {
  DEPLOY_RAILWAY_TOKEN: 'token',
  DEPLOY_RAILWAY_SERVICE_ID: 'web-service',
  RAILWAY_PROJECT_ID: 'project',
  RAILWAY_ENVIRONMENT_ID: 'environment',
}

// The hook reads env at import and keeps its throttle in module state, so each
// test imports a fresh copy.
async function loadHook(extraEnv: Record<string, string> = {}) {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '1')
  vi.stubEnv('DEPLOY_HOOK_URL', HOOK_URL)
  for (const [name, value] of Object.entries(extraEnv)) vi.stubEnv(name, value)
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) =>
    url === RAILWAY_API ? Response.json({ data: { variableUpsert: true } }) : new Response('ok'),
  )
  vi.stubGlobal('fetch', fetchMock)
  const { triggerDeployAfterChange } = await import('./triggerDeploy')
  const change = (query: Record<string, unknown>, status = 'published', previous = 'draft') => {
    const logger = { info: vi.fn(), error: vi.fn() }
    triggerDeployAfterChange({
      doc: { id: 'doc1', _status: status },
      previousDoc: { id: 'doc1', _status: previous },
      req: { query, payload: { logger } },
    } as unknown as Parameters<CollectionAfterChangeHook>[0])
    return logger
  }
  const body = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body as string)
  return { change, fetchMock, body }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each([
  ['skips a draft save over a published document', { draft: true }, 0],
  ['deploys on an unpublish, which sends no draft flag', {}, 1],
])('%s', async (_, query, calls) => {
  const { change, fetchMock } = await loadHook()
  change(query, 'draft', 'published')
  expect(fetchMock).toHaveBeenCalledTimes(calls)
})

it('upserts a new CONTENT_BUILD_ID at once and once more at the end of the window, instead of the webhook POST, when the Railway env is set', async () => {
  vi.useFakeTimers()
  const { change, fetchMock, body } = await loadHook(RAILWAY_ENV)
  change({})
  change({})
  expect(fetchMock).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(299_999)
  expect(fetchMock).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(300_000)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([RAILWAY_API, RAILWAY_API])
  const [first, second] = [body(0).variables.input, body(1).variables.input]
  expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({ 'Project-Access-Token': 'token' })
  expect(first).toMatchObject({
    projectId: 'project',
    environmentId: 'environment',
    serviceId: 'web-service',
    name: 'CONTENT_BUILD_ID',
  })
  expect(second.value).not.toBe(first.value)
})

it.each([
  ['GraphQL errors', Response.json({ errors: [{ message: 'Not Authorized' }] })],
  ['no variableUpsert result', Response.json({ data: null })],
  ['a body that is not JSON', new Response('ok')],
])('logs a failed upsert when the Railway API answers 200 with %s', async (_, answer) => {
  const { change, fetchMock } = await loadHook(RAILWAY_ENV)
  fetchMock.mockResolvedValueOnce(answer)
  const logger = change({})
  await vi.waitFor(() => expect(logger.error).toHaveBeenCalledOnce())
  expect(logger.error.mock.calls[0]![0]).toMatch(/^CONTENT_BUILD_ID upsert failed/)
  expect(logger.info).not.toHaveBeenCalled()
})
