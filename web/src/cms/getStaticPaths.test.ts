import { expect, it, vi } from 'vitest'

import { getStaticPaths } from './getStaticPaths'

vi.mock('@astroload/cms/src/site-config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  LOCALES: ['en'],
  LOCALE_URL_PREFIX: false,
}))

vi.mock('./sdk', () => ({
  payloadSDK: {
    request: async () =>
      Response.json(
        [1, 2].map((id) => ({ collection: 'pages', id, paths: { en: '/' }, updatedAt: '' })),
      ),
  },
}))

it('getStaticPaths fails when two documents share a path', async () => {
  await expect(getStaticPaths()).rejects.toThrow('pages/1 and pages/2')
})
