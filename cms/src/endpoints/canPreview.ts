import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'

// Preview requests read drafts, so only panel users and the preview API key
// may make them.
export function canPreview(req: PayloadRequest): boolean {
  const { user } = req
  if (!user) return false
  if (user.collection === 'users') return true
  return user.collection === 'api-keys' && user.type === 'preview'
}

// The pages plugin reads parents with overrideAccess and the operation's draft
// flag, and caches them under one context key for both modes.
export const guardDraftReads: CollectionBeforeOperationHook = ({
  args,
  context,
  operation,
  overrideAccess,
  req,
}) => {
  const next =
    operation === 'read' && !overrideAccess && args.draft && !canPreview(req)
      ? { ...args, draft: false }
      : args
  const draft = ('draft' in next ? next.draft : context.draft) === true
  const caches = (context.ancestorCaches ??= { draft: new Map(), published: new Map() }) as {
    draft: Map<string, unknown>
    published: Map<string, unknown>
  }
  context.pagesPluginAncestorCache = draft ? caches.draft : caches.published
  return next
}
