import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

import { randomUUID } from 'node:crypto'

import { env } from '../env'

// Throttles deploy triggers per process. The first change fires at once, and
// later changes in the window collapse into one trailing trigger at its end.
// The throttle state lives in memory, so a restart drops a queued trailing
// trigger. docs/astroload/maintenance.md describes how to recover a lost deploy.
const WINDOW_MS = 300_000

type Logger = PayloadRequest['payload']['logger']

function railwayEnabled(): boolean {
  return Boolean(
    env.DEPLOY_RAILWAY_TOKEN &&
    env.DEPLOY_RAILWAY_SERVICE_ID &&
    env.RAILWAY_PROJECT_ID &&
    env.RAILWAY_ENVIRONMENT_ID,
  )
}

function hookHeaders(): Headers {
  const result = new Headers({ 'Content-Type': 'application/json' })
  if (!env.DEPLOY_HOOK_HEADERS) return result
  const headers: unknown = JSON.parse(env.DEPLOY_HOOK_HEADERS)
  if (
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers) ||
    Object.values(headers).some((value) => typeof value !== 'string')
  ) {
    throw new Error('DEPLOY_HOOK_HEADERS is not a JSON object of strings')
  }
  for (const [name, value] of Object.entries(headers)) result.set(name, value)
  return result
}

// A new CONTENT_BUILD_ID makes Railway rebuild the web service unless Skipped Builds is on.
async function upsertBuildId(): Promise<string | null> {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Project-Access-Token': env.DEPLOY_RAILWAY_TOKEN!,
    },
    body: JSON.stringify({
      query: 'mutation ($input: VariableUpsertInput!) { variableUpsert(input: $input) }',
      variables: {
        input: {
          projectId: env.RAILWAY_PROJECT_ID,
          environmentId: env.RAILWAY_ENVIRONMENT_ID,
          serviceId: env.DEPLOY_RAILWAY_SERVICE_ID,
          name: 'CONTENT_BUILD_ID',
          value: randomUUID(),
        },
      },
    }),
  })
  // GraphQL reports a failed mutation as 200 with an errors array.
  const json = (await res.json().catch(() => ({}))) as {
    data?: { variableUpsert?: boolean }
    errors?: { message: string }[]
  }
  if (res.ok && json.data?.variableUpsert === true) return null
  return `${res.status} ${json.errors?.map((e) => e.message).join('; ') ?? (res.ok ? 'no variableUpsert result' : res.statusText)}`
}

async function fire(logger: Logger): Promise<void> {
  try {
    if (railwayEnabled()) {
      const error = await upsertBuildId()
      if (error) return logger.error(`CONTENT_BUILD_ID upsert failed: ${error}`)
      return logger.info('CONTENT_BUILD_ID upserted')
    }
    if (!env.DEPLOY_HOOK_URL) return
    const res = await fetch(env.DEPLOY_HOOK_URL, {
      method: 'POST',
      headers: hookHeaders(),
      body: env.DEPLOY_HOOK_BODY ?? JSON.stringify({ trigger: 'cms-change' }),
    })
    if (res.ok) logger.info(`deploy webhook fired: ${res.status}`)
    else logger.error(`deploy webhook failed: ${res.status} ${res.statusText}`)
  } catch (err) {
    logger.error(`deploy trigger errored: ${err instanceof Error ? err.message : String(err)}`)
  }
}

let windowTimer: NodeJS.Timeout | null = null
let pending: Logger | null = null

function arm(): void {
  const timer = setTimeout(() => {
    windowTimer = null
    if (pending) {
      const logger = pending
      pending = null
      void fire(logger)
      arm()
    }
  }, WINDOW_MS)
  timer.unref?.()
  windowTimer = timer
}

function scheduleDeploy(logger: Logger): void {
  if (!env.DEPLOY_HOOK_URL && !railwayEnabled()) return
  if (windowTimer) {
    pending = logger
    return
  }
  void fire(logger)
  arm()
}

// True when doc and previousDoc match apart from updatedAt, which Payload sets
// on every save. A missing doc counts as changed.
function unchanged(doc: unknown, previousDoc: unknown): boolean {
  if (!doc || !previousDoc) return false
  return stable(doc) === stable(previousDoc)
}

function stable(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  const { updatedAt: _updatedAt, ...rest } = value as Record<string, unknown>
  return JSON.stringify(rest)
}

export const triggerDeployAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  // A draft save that stays a draft does not change the published document,
  // so it must not use up the leading deploy. This covers autosave (every
  // 1.5 s while an editor types) and Save Draft, including the first draft
  // over a published doc, where previousDoc still reads 'published'.
  // Unpublish has the same status pair but sends no ?draft=true, so it falls
  // through. The REST endpoint turns the flag into a boolean before the hook
  // runs, and the string check covers paths that skip that step.
  const isDraftSave = req.query?.draft === true || req.query?.draft === 'true'
  if (isDraftSave && doc?._status === 'draft') return doc

  // Schedule a deploy for a first publish, a changed published document, or
  // an unpublish.
  const affectsPublished = doc?._status === 'published' || previousDoc?._status === 'published'
  if (!affectsPublished) return doc

  // A publish with no edits writes the same document back. previousDoc is the
  // latest version, drafts included, so publishing a draft differs at least
  // in _status.
  if (unchanged(doc, previousDoc)) return doc

  scheduleDeploy(req.payload.logger)
  return doc
}

export const triggerDeployAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (doc?._status !== 'published') return doc

  scheduleDeploy(req.payload.logger)
  return doc
}

// For collections without drafts, such as media, redirects, and forms.
// Their data is baked into the static build, so every real change needs a
// deploy.
export const triggerDeployAlwaysAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req,
}) => {
  if (unchanged(doc, previousDoc)) return doc

  scheduleDeploy(req.payload.logger)
  return doc
}

export const triggerDeployAlwaysAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  scheduleDeploy(req.payload.logger)
  return doc
}

export const triggerDeployGlobalAfterChange: GlobalAfterChangeHook = ({
  doc,
  previousDoc,
  req,
}) => {
  if (unchanged(doc, previousDoc)) return doc

  scheduleDeploy(req.payload.logger)
  return doc
}
