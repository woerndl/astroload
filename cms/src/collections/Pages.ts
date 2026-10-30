import type { PageCollectionConfig } from '@jhb.software/payload-pages-plugin'
import {
  APIError,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
  ValidationError,
} from 'payload'

import { contentAccess } from '../access/contentAccess'
import { FormBlock } from '../blocks/FormBlock'
import { ImageBlock } from '../blocks/ImageBlock'
import { PostsListBlock } from '../blocks/PostsListBlock'
import { RichTextBlock } from '../blocks/RichTextBlock'
import { guardDraftReads } from '../endpoints/canPreview'
import {
  rememberDraftSave,
  triggerDeployAfterChange,
  triggerDeployAfterDelete,
} from '../hooks/triggerDeploy'
import {
  draftVersions,
  isLocale,
  livePreviewBreakpoints,
  pageCollectionsSlugs,
  pageTemplateLabels,
  pageTemplates,
} from '../shared'

// A save without _status keeps the status of the latest version, which is
// 'draft' after a draft save, so such a save also unpublishes.
const unpublishes = ({ data, originalDoc, context }: Parameters<CollectionBeforeValidateHook>[0]) =>
  !context?.draftSave && (data?._status ?? originalDoc?._status) === 'draft'

const relationId = (value: unknown) =>
  value && typeof value === 'object' ? String((value as { id: unknown }).id) : String(value ?? '')

// A localized slug arrives as a string for one locale or as an object keyed
// by locale code for locale 'all'. Any other value counts as a change, and so
// does a key that is not a locale, because Mongoose casts an object with a
// string `_id` to that `_id`. A locale without a stored slug may get its first
// slug or null.
const slugChanged = (next: unknown, prev: unknown, allLocales: boolean): boolean => {
  if (next === undefined) return false
  if (allLocales && next && typeof next === 'object' && !Array.isArray(next)) {
    const stored = (prev ?? {}) as Record<string, unknown>
    return Object.entries(next).some(
      ([code, value]) => !isLocale(code) || (stored[code] != null && value !== stored[code]),
    )
  }
  if (typeof next !== 'string') return !(next === null && prev == null)
  return prev != null && next !== prev
}

// A templated page's body is written in code for its seeded path, so its
// template, parent, root state and slug stay as seeded. Seeds pass
// context.seed to set them.
const guardTemplatedPage: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  context,
  req,
}) => {
  if (context?.seed) return data
  if (operation === 'create') {
    // A second document for a template would shadow the first.
    if (data?.template && data.template !== 'default') {
      const existing = await req.payload.find({
        collection: 'pages',
        depth: 0,
        draft: true,
        limit: 1,
        pagination: false,
        where: { template: { equals: data.template } },
        req,
      })
      if (existing.docs.length > 0) {
        throw new APIError(`Only one page can use the template "${data.template}".`, 400)
      }
    }
    return data
  }
  if (operation !== 'update' || !originalDoc) return data
  if (data?.template !== undefined && data.template !== originalDoc.template) {
    throw new APIError('A page keeps the template it was created with.', 400)
  }
  if (originalDoc.template === 'default') return data
  // A restore runs these hooks on the default-locale data only and writes the
  // other locales from the version, which can hold an older slug.
  if (context?.isRestoringVersion) {
    throw new APIError(
      'Versions of a templated page cannot be restored. Copy the content from the version by hand.',
      400,
    )
  }
  const fixed =
    (data?.parent !== undefined && relationId(data.parent) !== relationId(originalDoc.parent)) ||
    (data?.isRootPage !== undefined &&
      (data.isRootPage ?? false) !== Boolean(originalDoc.isRootPage)) ||
    slugChanged(data?.slug, originalDoc.slug, req.locale === 'all')
  if (fixed) {
    throw new APIError(
      'The slug, parent and root state of a templated page are fixed in code.',
      400,
    )
  }
  return data
}

async function requirePublishedParent(parent: string, collection: string, req: PayloadRequest) {
  const { totalDocs } = await req.payload.count({
    collection: 'pages',
    where: { id: { equals: parent }, _status: { equals: 'published' } },
    req,
  })
  if (totalDocs > 0) return
  throw new ValidationError({
    collection,
    errors: [{ path: 'parent', message: 'Publish the parent page first.' }],
    req,
  })
}

async function refusePublishedChildren(id: string, req: PayloadRequest) {
  const where = { parent: { equals: id }, _status: { equals: 'published' } }
  for (const collection of pageCollectionsSlugs) {
    const { totalDocs } = await req.payload.count({ collection, where, req })
    if (totalDocs === 0) continue
    throw new APIError(
      'This page has published children. Unpublish them or move them to another parent first.',
      400,
    )
  }
}

// The pages plugin copies a child's breadcrumbs from the parent's main
// document, which only a publish or an unpublish changes.
export const guardPublishedParent: CollectionBeforeValidateHook = async (args) => {
  const { collection, data, originalDoc, operation, context, req } = args
  if (context?.seed || (context?.isRestoringVersion && context.draftSave)) return data
  if (data?._status !== undefined && data._status !== 'draft' && data._status !== 'published') {
    throw new APIError('The status must be draft or published.', 400)
  }
  if (operation === 'update' && originalDoc && unpublishes(args)) {
    if (collection.slug === 'pages') await refusePublishedChildren(String(originalDoc.id), req)
    return data
  }
  const status = context?.draftSave ? data?._status : (data?._status ?? originalDoc?._status)
  if (status !== 'published') return data
  const parent = relationId(data?.parent !== undefined ? data.parent : originalDoc?.parent)
  if (parent) await requirePublishedParent(parent, collection.slug, req)
  return data
}

export const Pages: PageCollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'path', 'updatedAt', '_status'],
    livePreview: { breakpoints: [...livePreviewBreakpoints] },
  },
  // Duplicate runs the create access check before it copies the source fields,
  // so the check does not see the template.
  disableDuplicate: true,
  versions: draftVersions,
  hooks: {
    beforeOperation: [rememberDraftSave, guardDraftReads],
    beforeValidate: [guardTemplatedPage, guardPublishedParent],
    afterChange: [triggerDeployAfterChange],
    afterDelete: [triggerDeployAfterDelete],
  },
  access: {
    ...contentAccess,
    create: (args) => {
      if (!contentAccess.create(args)) return false
      const template = (args.data as { template?: string } | undefined)?.template
      return !template || template === 'default'
    },
    // not_in also matches documents saved before the template field existed.
    delete: (args) =>
      contentAccess.delete(args) ? { template: { not_in: [...pageTemplates] } } : false,
  },
  page: {
    parent: {
      collection: 'pages',
      name: 'parent',
    },
    isRootCollection: true,
  },
  defaultPopulate: {
    title: true,
    path: true,
  },
  fields: [
    {
      name: 'template',
      type: 'select',
      required: true,
      defaultValue: 'default',
      options: (['default', ...pageTemplates] as const).map((value) => ({
        value,
        label: pageTemplateLabels[value],
      })),
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'sections',
      type: 'blocks',
      blocks: [RichTextBlock, ImageBlock, FormBlock, PostsListBlock],
      admin: { condition: (data) => !data?.template || data.template === 'default' },
    },
  ],
}
