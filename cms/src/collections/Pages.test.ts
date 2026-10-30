import type { AccessArgs, CollectionBeforeValidateHook } from 'payload'

import { expect, it, vi } from 'vitest'

vi.mock('../shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared')>()),
  pageTemplates: ['landing'],
}))
vi.stubEnv('SKIP_ENV_VALIDATION', '1')
const { Pages } = await import('./Pages')

type Args = {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  existing?: Record<string, unknown>[]
  context?: Record<string, unknown>
  operation?: string
  locale?: string
}

const validate = (args: Args) =>
  Pages.hooks!.beforeValidate![0]!({
    data: args.data,
    // Payload passes an empty originalDoc on create.
    originalDoc: args.originalDoc ?? {},
    context: args.context ?? {},
    operation: args.operation ?? (args.originalDoc ? 'update' : 'create'),
    req: {
      payload: {
        find: async ({ where }: { where: { template: { equals: string } } }) => ({
          docs: (args.existing ?? []).filter((doc) => doc.template === where.template.equals),
        }),
      },
      locale: args.locale ?? 'en',
    },
  } as unknown as Parameters<CollectionBeforeValidateHook>[0])

const home = { id: 'p1', template: 'landing', slug: '', parent: null, isRootPage: true }
const child = { id: 'p2', template: 'landing', slug: 'contact', parent: 'p1', isRootPage: false }
const slugs = { ...child, slug: { en: 'contact', de: 'kontakt' } }
const defaultChild = { ...child, template: 'default' }
const restore = { isRestoringVersion: true }

// prettier-ignore
it.each<[string, Args, string]>([
  ['a second document for a template', { data: { template: 'landing' }, existing: [home] }, 'Only one page'],
  ['a template change', { data: { template: 'default' }, originalDoc: home }, 'keeps the template'],
  ['a change to a template', { data: { template: 'landing' }, originalDoc: { ...home, template: 'default' } }, 'keeps the template'],
  ['a slug change', { data: { slug: 'kontakt' }, originalDoc: child }, 'fixed in code'],
  ['a slug change in one locale of an all-locale write', { data: { slug: { en: 'contact', de: 'neu' } }, originalDoc: slugs, locale: 'all' }, 'fixed in code'],
  ['an unknown locale key', { data: { slug: { en: 'contact', xx: 'neu' } }, originalDoc: slugs, locale: 'all' }, 'fixed in code'],
  ['an object slug on a one-locale write', { data: { slug: { _id: 'renamed' } }, originalDoc: child }, 'fixed in code'],
  ['a parent change', { data: { parent: 'p9' }, originalDoc: child }, 'fixed in code'],
  ['a root state change', { data: { isRootPage: false }, originalDoc: home }, 'fixed in code'],
  ["a string root state such as '0'", { data: { isRootPage: '0' }, originalDoc: home }, 'fixed in code'],
  ['a version restore', { data: { slug: 'contact' }, originalDoc: child, context: restore }, 'cannot be restored'],
])('rejects %s on a templated page', async (_, args, message) => {
  await expect(validate(args)).rejects.toThrow(message)
})

// prettier-ignore
it.each<[string, Args]>([
  ['the first document for a template', { data: { template: 'landing' }, existing: [defaultChild] }],
  ['a default page', { data: { template: 'default' } }],
  ['unchanged slugs on an all-locale write', { data: { slug: { en: 'contact', de: 'kontakt' } }, originalDoc: slugs, locale: 'all' }],
  ['the first slug of a locale that has none', { data: { slug: 'contact' }, originalDoc: { ...child, slug: null } }],
  ['null as the root state of a page that is not the root', { data: { isRootPage: null }, originalDoc: child }],
  ['an unchanged save with a populated parent', { data: { ...child, parent: { id: 'p1' }, title: 'New' }, originalDoc: child }],
  ['an operation other than create and update', { data: { slug: 'renamed' }, originalDoc: child, operation: 'validate' }],
  ['a structural change on a default page', { data: { slug: 'renamed', parent: 'p9' }, originalDoc: defaultChild }],
  ['a version restore on a default page', { data: { slug: 'old' }, originalDoc: defaultChild, context: restore }],
  ['a structural change in a seed', { data: { slug: 'renamed', parent: 'p9' }, originalDoc: child, context: { seed: true } }],
])('accepts %s', async (_, args) => {
  await expect(validate(args)).resolves.toEqual(args.data)
})

it('lets editors create default pages only', () => {
  const access = (data?: Record<string, unknown>) =>
    ({ req: { user: { collection: 'users', roles: ['editor'] } }, data }) as unknown as AccessArgs
  expect(
    [{}, { template: 'default' }, { template: 'landing' }].map((d) =>
      Pages.access!.create!(access(d)),
    ),
  ).toEqual([true, true, false])
})
