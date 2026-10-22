import type { AccessArgs, CollectionBeforeValidateHook } from 'payload'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { pageTemplates } from '../shared'

// The starter ships no template, so the tests use 'home' as an example value.
// The guards compare against 'default' only. The delete rule reads pageTemplates.
async function loadPages() {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '1')
  const { Pages } = await import('./Pages')
  return Pages
}

const editor = { collection: 'users', roles: ['editor'] }

async function validate(args: {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  existing?: unknown[]
  context?: Record<string, unknown>
  operation?: string
  locale?: string
}) {
  const Pages = await loadPages()
  const hook = Pages.hooks!.beforeValidate![0]!
  const find = vi.fn().mockResolvedValue({ docs: args.existing ?? [] })
  return hook({
    data: args.data,
    // Payload passes an empty originalDoc on create.
    originalDoc: args.originalDoc ?? {},
    context: args.context ?? {},
    operation: args.operation ?? (args.originalDoc ? 'update' : 'create'),
    req: { payload: { find }, locale: args.locale ?? 'en' },
  } as unknown as Parameters<CollectionBeforeValidateHook>[0])
}

const homeDoc = { id: 'p1', template: 'home', slug: '', parent: null, isRootPage: true }
const childDoc = { id: 'p2', template: 'home', slug: 'contact', parent: 'p1', isRootPage: false }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('templated page guards', () => {
  it('rejects a second document for a template', async () => {
    await expect(validate({ data: { template: 'home' }, existing: [homeDoc] })).rejects.toThrow(
      'Only one page',
    )
  })

  it('accepts the first document for a template and any default page', async () => {
    await expect(validate({ data: { template: 'home' } })).resolves.toEqual({ template: 'home' })
    await expect(validate({ data: { template: 'default' } })).resolves.toEqual({
      template: 'default',
    })
  })

  it('rejects a template change in both directions', async () => {
    await expect(validate({ data: { template: 'default' }, originalDoc: homeDoc })).rejects.toThrow(
      'keeps the template',
    )
    await expect(
      validate({ data: { template: 'home' }, originalDoc: { ...homeDoc, template: 'default' } }),
    ).rejects.toThrow('keeps the template')
  })

  it('rejects a slug change and an unknown locale key', async () => {
    await expect(validate({ data: { slug: 'kontakt' }, originalDoc: childDoc })).rejects.toThrow(
      'fixed in code',
    )
    const allSlugs = { ...childDoc, slug: { en: 'contact', de: 'kontakt' } }
    await expect(
      validate({
        data: { slug: { en: 'contact', de: 'kontakt-neu' } },
        originalDoc: allSlugs,
        locale: 'all',
      }),
    ).rejects.toThrow('fixed in code')
    await expect(
      validate({
        data: { slug: { en: 'contact', xx: 'neu' } },
        originalDoc: allSlugs,
        locale: 'all',
      }),
    ).rejects.toThrow('fixed in code')
  })

  it('accepts an unchanged slug on a write to all locales', async () => {
    const data = { slug: { en: 'contact', de: 'kontakt' } }
    const originalDoc = { ...childDoc, slug: { en: 'contact', de: 'kontakt' } }
    await expect(validate({ data, originalDoc, locale: 'all' })).resolves.toEqual(data)
  })

  it('rejects an object slug on a write to one locale', async () => {
    await expect(
      validate({ data: { slug: { _id: 'renamed' } }, originalDoc: childDoc }),
    ).rejects.toThrow('fixed in code')
  })

  it('accepts the first slug of a locale that has none', async () => {
    const data = { slug: 'contact' }
    await expect(validate({ data, originalDoc: { ...childDoc, slug: null } })).resolves.toEqual(
      data,
    )
  })

  it('rejects a parent change and a root state change', async () => {
    await expect(validate({ data: { parent: 'p9' }, originalDoc: childDoc })).rejects.toThrow(
      'fixed in code',
    )
    await expect(validate({ data: { isRootPage: false }, originalDoc: homeDoc })).rejects.toThrow(
      'fixed in code',
    )
  })

  it("rejects a string root state such as '0'", async () => {
    await expect(validate({ data: { isRootPage: '0' }, originalDoc: homeDoc })).rejects.toThrow(
      'fixed in code',
    )
  })

  it('accepts null as the root state of a page that is not the root', async () => {
    const data = { isRootPage: null }
    await expect(validate({ data, originalDoc: childDoc })).resolves.toEqual(data)
  })

  it('accepts an unchanged save with a populated parent', async () => {
    const data = {
      template: 'home',
      slug: 'contact',
      parent: { id: 'p1' },
      isRootPage: false,
      title: 'New',
    }
    await expect(validate({ data, originalDoc: childDoc })).resolves.toEqual(data)
  })

  it('ignores an operation other than create and update', async () => {
    const data = { template: 'default', slug: 'renamed' }
    await expect(validate({ data, originalDoc: childDoc, operation: 'validate' })).resolves.toEqual(
      data,
    )
  })

  it('rejects a version restore on a templated page only', async () => {
    const context = { isRestoringVersion: true }
    await expect(
      validate({ data: { slug: 'contact' }, originalDoc: childDoc, context }),
    ).rejects.toThrow('cannot be restored')
    const data = { slug: 'old' }
    await expect(
      validate({ data, originalDoc: { ...childDoc, template: 'default' }, context }),
    ).resolves.toEqual(data)
  })

  it('lets any structural change through on a default page and in a seed', async () => {
    const data = { slug: 'renamed', parent: 'p9' }
    await expect(
      validate({ data, originalDoc: { ...childDoc, template: 'default' } }),
    ).resolves.toEqual(data)
    await expect(
      validate({ data, originalDoc: childDoc, context: { seed: true } }),
    ).resolves.toEqual(data)
  })
})

describe('templated page access', () => {
  const access = (data?: Record<string, unknown>) =>
    ({ req: { user: editor }, data }) as unknown as AccessArgs

  it('allows create for default pages only', async () => {
    const Pages = await loadPages()
    expect(Pages.access!.create!(access({ template: 'default' }))).toBe(true)
    expect(Pages.access!.create!(access({}))).toBe(true)
    expect(Pages.access!.create!(access({ template: 'home' }))).toBe(false)
  })

  it('limits delete to pages outside the template list', async () => {
    const Pages = await loadPages()
    expect(Pages.access!.delete!(access())).toEqual({
      template: { not_in: [...pageTemplates] },
    })
  })

  it('disables duplicate', async () => {
    const Pages = await loadPages()
    expect(Pages.disableDuplicate).toBe(true)
  })
})
