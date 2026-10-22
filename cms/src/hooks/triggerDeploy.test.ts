import type { CollectionAfterChangeHook } from 'payload'

import { afterEach, describe, expect, it, vi } from 'vitest'

const HOOK_URL = 'https://deploy.example.com/hook'
const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

// cms/src/env.ts reads process.env at import, so each test stubs the environment and resets the module registry before it imports the hook.
async function loadHook(extraEnv: Record<string, string> = {}) {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '1')
  vi.stubEnv('DEPLOY_HOOK_URL', HOOK_URL)
  for (const [name, value] of Object.entries(extraEnv)) vi.stubEnv(name, value)
  const fetchMock = vi
    .fn()
    .mockImplementation(async (url: string) =>
      url === RAILWAY_API ? Response.json({ data: { variableUpsert: true } }) : new Response('ok'),
    )
  vi.stubGlobal('fetch', fetchMock)
  const { triggerDeployAfterChange } = await import('./triggerDeploy')
  return { triggerDeployAfterChange, fetchMock }
}

function change(
  hook: CollectionAfterChangeHook,
  query: Record<string, unknown>,
  status: string,
  previousStatus: string,
) {
  const logger = { info: vi.fn(), error: vi.fn() }
  hook({
    doc: { id: 'doc1', _status: status },
    previousDoc: { id: 'doc1', _status: previousStatus },
    req: { query, payload: { logger } },
  } as unknown as Parameters<CollectionAfterChangeHook>[0])
  return logger
}

const RAILWAY_ENV = {
  DEPLOY_RAILWAY_TOKEN: 'token',
  DEPLOY_RAILWAY_SERVICE_ID: 'web-service',
  RAILWAY_PROJECT_ID: 'project',
  RAILWAY_ENVIRONMENT_ID: 'environment',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('triggerDeployAfterChange', () => {
  it('skips a draft save when the REST endpoint sends draft as a boolean', async () => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook()
    change(triggerDeployAfterChange, { draft: true }, 'draft', 'published')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deploys on unpublish, which sends no draft flag', async () => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook()
    change(triggerDeployAfterChange, {}, 'draft', 'published')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('deploys on publish', async () => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook()
    change(triggerDeployAfterChange, {}, 'published', 'draft')
    expect(fetchMock).toHaveBeenCalledWith(HOOK_URL, expect.objectContaining({ method: 'POST' }))
  })

  it('sends DEPLOY_HOOK_BODY as the webhook body', async () => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook({
      DEPLOY_HOOK_BODY: '{"ref":"main"}',
    })
    change(triggerDeployAfterChange, {}, 'published', 'draft')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(sentBody(fetchMock, 0)).toEqual({ ref: 'main' })
  })

  it('sends DEPLOY_HOOK_HEADERS with the webhook POST, replacing the default Content-Type', async () => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook({
      DEPLOY_HOOK_HEADERS: '{"Authorization":"Bearer secret","content-type":"text/plain"}',
    })
    change(triggerDeployAfterChange, {}, 'published', 'draft')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('authorization')).toBe('Bearer secret')
    expect(headers.get('content-type')).toBe('text/plain')
  })

  it('upserts CONTENT_BUILD_ID instead of the webhook POST when the Railway env is set', async () => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook(RAILWAY_ENV)
    change(triggerDeployAfterChange, {}, 'published', 'draft')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(RAILWAY_API)
    expect(init.headers).toMatchObject({ 'Project-Access-Token': 'token' })
    const { input } = sentBody(fetchMock, 0).variables
    expect(input).toEqual({
      projectId: 'project',
      environmentId: 'environment',
      serviceId: 'web-service',
      name: 'CONTENT_BUILD_ID',
      value: expect.stringMatching(UUID),
    })
  })

  it('sets CONTENT_BUILD_ID to a new value on each upsert', async () => {
    vi.useFakeTimers()
    const { triggerDeployAfterChange, fetchMock } = await loadHook(RAILWAY_ENV)
    change(triggerDeployAfterChange, {}, 'published', 'draft')
    change(triggerDeployAfterChange, {}, 'published', 'draft')
    await vi.advanceTimersByTimeAsync(300_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [first, second] = [0, 1].map((call) => sentBody(fetchMock, call).variables.input.value)
    expect(second).not.toBe(first)
  })

  it.each([
    ['GraphQL errors', Response.json({ errors: [{ message: 'Not Authorized' }] })],
    ['no variableUpsert result', Response.json({ data: null })],
    ['a body that is not JSON', new Response('ok')],
  ])('logs a failed upsert when the Railway API answers 200 with %s', async (_, answer) => {
    const { triggerDeployAfterChange, fetchMock } = await loadHook(RAILWAY_ENV)
    fetchMock.mockResolvedValueOnce(answer)
    const logger = change(triggerDeployAfterChange, {}, 'published', 'draft')
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledOnce())
    expect(logger.error.mock.calls[0][0]).toMatch(/^CONTENT_BUILD_ID upsert failed/)
    expect(logger.info).not.toHaveBeenCalled()
  })
})
