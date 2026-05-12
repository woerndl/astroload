import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

import { env } from '../env'

// Per-doc throttle window for webhook POSTs.
const WINDOW_MS = 300_000

type DeployPayload = {
  collection?: string
  global?: string
  id?: string | number
  locale?: string
  op: 'change' | 'delete'
}

type Logger = PayloadRequest['payload']['logger']

type Entry = {
  pending?: { body: DeployPayload; logger: Logger }
  timer: NodeJS.Timeout
}

const inFlight = new Map<string, Entry>()

function fire(key: string, body: DeployPayload, logger: Logger): void {
  fetch(env.DEPLOY_HOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (res.ok) {
        logger.info(`deploy webhook fired for ${key}: ${res.status}`)
      } else {
        logger.error(`deploy webhook failed for ${key}: ${res.status} ${res.statusText}`)
      }
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`deploy webhook errored for ${key}: ${message}`)
    })
}

function startTimer(key: string): NodeJS.Timeout {
  const timer = setTimeout(() => {
    const entry = inFlight.get(key)
    if (!entry) return
    if (entry.pending) {
      const { body, logger } = entry.pending
      fire(key, body, logger)
      inFlight.set(key, { timer: startTimer(key) })
    } else {
      inFlight.delete(key)
    }
  }, WINDOW_MS)
  timer.unref?.()
  return timer
}

function schedulePost(key: string, body: DeployPayload, logger: Logger): void {
  if (!env.DEPLOY_HOOK_URL) return

  const existing = inFlight.get(key)
  if (!existing) {
    fire(key, body, logger)
    inFlight.set(key, { timer: startTimer(key) })
    return
  }
  existing.pending = { body, logger }
}

export const triggerDeployAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req,
  collection,
}) => {
  const becamePublished =
    doc?._status === 'published' && previousDoc?._status !== 'published'
  if (!becamePublished) return doc

  schedulePost(
    `${collection.slug}:${doc.id}`,
    {
      collection: collection.slug,
      id: doc.id,
      locale: typeof req.locale === 'string' ? req.locale : undefined,
      op: 'change',
    },
    req.payload.logger,
  )
  return doc
}

export const triggerDeployAfterDelete: CollectionAfterDeleteHook = ({
  doc,
  req,
  collection,
  id,
}) => {
  if (doc?._status !== 'published') return doc

  schedulePost(
    `${collection.slug}:${id}`,
    {
      collection: collection.slug,
      id,
      locale: typeof req.locale === 'string' ? req.locale : undefined,
      op: 'delete',
    },
    req.payload.logger,
  )
  return doc
}

// For collections without drafts/publishing (e.g. redirects). Every save and
// delete needs a rebuild because the data is baked into the static output.
export const triggerDeployAlwaysAfterChange: CollectionAfterChangeHook = ({
  doc,
  req,
  collection,
}) => {
  schedulePost(
    `${collection.slug}:${doc.id}`,
    {
      collection: collection.slug,
      id: doc.id,
      locale: typeof req.locale === 'string' ? req.locale : undefined,
      op: 'change',
    },
    req.payload.logger,
  )
  return doc
}

export const triggerDeployAlwaysAfterDelete: CollectionAfterDeleteHook = ({
  doc,
  req,
  collection,
  id,
}) => {
  schedulePost(
    `${collection.slug}:${id}`,
    {
      collection: collection.slug,
      id,
      locale: typeof req.locale === 'string' ? req.locale : undefined,
      op: 'delete',
    },
    req.payload.logger,
  )
  return doc
}

export const triggerDeployGlobalAfterChange: GlobalAfterChangeHook = ({
  doc,
  req,
  global,
}) => {
  schedulePost(
    `global:${global.slug}`,
    {
      global: global.slug,
      locale: typeof req.locale === 'string' ? req.locale : undefined,
      op: 'change',
    },
    req.payload.logger,
  )
  return doc
}
