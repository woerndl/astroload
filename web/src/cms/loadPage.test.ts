import { expect, it, vi } from 'vitest'

import { loadCatchAllPage } from './loadPage'

// Plain functions, because a vi.fn marks the promises it returns as handled.
const cms = vi.hoisted(() => ({
  globals: (): Promise<unknown> => Promise.resolve({}),
  page: (): Promise<unknown> => Promise.resolve({}),
}))
vi.mock('./getGlobalData', () => ({ getGlobalData: () => cms.globals() }))
vi.mock('./getPageData', () => ({ getPageData: () => cms.page() }))
vi.mock('./getPageByPath', () => ({}))

const load = () =>
  loadCatchAllPage({
    locale: 'en',
    fullPath: '/en/blog/page/2',
    props: { id: 1, collection: 'posts', paths: { en: '/en/blog' } },
    locals: {} as App.Locals,
  })

it('loadCatchAllPage rejects a document without its enumerated path', async () => {
  cms.page = async () => ({ path: '/en/blog' })
  await expect(load()).resolves.toBeTruthy()
  cms.page = async () => ({ path: '/en/news' })
  await expect(load()).rejects.toThrow('moved')
  cms.page = async () => ({})
  await expect(load()).rejects.toThrow('moved')
})

it('loadCatchAllPage leaves no unhandled globals rejection when the page load fails', async () => {
  cms.globals = () => Promise.reject(new Error('globals down'))
  cms.page = () => new Promise((_, reject) => setTimeout(() => reject(new Error('page down')), 10))
  await expect(load()).rejects.toThrow('page down')
})
