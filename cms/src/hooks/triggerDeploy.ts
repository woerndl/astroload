import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

import { env } from '../env'

// One process-global throttle window for deploy webhook POSTs. A burst of
// publishes coalesces into a single leading fire plus at most one trailing fire
// per window. The webhook body is a bare
// trigger: a build hook (Railway, Vercel, Coolify) only needs the POST.
//
// State is process-local. A trailing deploy queued when the process restarts is
// lost. maintenance.md documents a latch recipe for hosts that need durability.
const WINDOW_MS = 300_000

type Logger = PayloadRequest['payload']['logger']

function fire(logger: Logger): void {
  fetch(env.DEPLOY_HOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'cms-change' }),
  })
    .then((res) => {
      if (res.ok) logger.info(`deploy webhook fired: ${res.status}`)
      else logger.error(`deploy webhook failed: ${res.status} ${res.statusText}`)
    })
    .catch((err) => {
      logger.error(`deploy webhook errored: ${err instanceof Error ? err.message : String(err)}`)
    })
}

let windowTimer: NodeJS.Timeout | null = null
let pending: Logger | null = null

function arm(): void {
  const timer = setTimeout(() => {
    windowTimer = null
    if (pending) {
      const logger = pending
      pending = null
      fire(logger)
      arm()
    }
  }, WINDOW_MS)
  timer.unref?.()
  windowTimer = timer
}

function scheduleDeploy(logger: Logger): void {
  if (!env.DEPLOY_HOOK_URL) return
  if (windowTimer) {
    pending = logger
    return
  }
  fire(logger)
  arm()
}

// True only when doc and previousDoc are identical apart from updatedAt, which
// Payload bumps on every save. A genuine save always differs elsewhere, so this
// errs toward firing: a missed change ships a stale site, a redundant fire only
// wastes a build.
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
  // A draft-flagged save that stays a draft never touches the published
  // parent document, so it must not consume the leading deploy. That covers
  // autosave (every ~1.5s while an editor types) and a manual Save Draft,
  // including the first draft over a published doc, where previousDoc still
  // reads 'published'. Unpublish shows the same status pair but sends no
  // ?draft=true and does rewrite the parent, so it falls through. The REST
  // endpoint coerces the query flag to a boolean before the hook runs. Accept
  // the string too for any path that skips that coercion.
  const isDraftSave = req.query?.draft === true || req.query?.draft === 'true'
  if (isDraftSave && doc?._status === 'draft') return doc

  // A deploy is warranted only when the published output changes: a first
  // publish, a changed re-publish of a live doc, or an unpublish that retracts
  // it.
  const affectsPublished = doc?._status === 'published' || previousDoc?._status === 'published'
  if (!affectsPublished) return doc

  // Publish with no edits writes the same document back. previousDoc is the
  // latest version (drafts included), so a real publish of drafted content
  // always differs, at least in _status.
  if (unchanged(doc, previousDoc)) return doc

  scheduleDeploy(req.payload.logger)
  return doc
}

export const triggerDeployAfterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (doc?._status !== 'published') return doc

  scheduleDeploy(req.payload.logger)
  return doc
}

// For collections without drafts/publishing (e.g. redirects). Every change to
// the published surface needs a rebuild because the data is baked into the
// static output. A save that changes nothing is skipped.
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

export const triggerDeployGlobalAfterChange: GlobalAfterChangeHook = ({ doc, previousDoc, req }) => {
  if (unchanged(doc, previousDoc)) return doc

  scheduleDeploy(req.payload.logger)
  return doc
}
