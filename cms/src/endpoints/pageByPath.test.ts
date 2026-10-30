import type { PayloadRequest } from 'payload'

import { expect, it } from 'vitest'

import { DEFAULT_LOCALE } from '../site-config'
import { stripLocalePath } from '../stripLocalePath'
import { getPageByPath } from './pageByPath'

it('answers 409 when two documents share a path', async () => {
  const doc = { id: 'p1', path: `/${DEFAULT_LOCALE}/shared` }
  const req = {
    user: { id: 'reader' },
    query: { path: stripLocalePath(doc.path) },
    payload: { find: async () => ({ docs: [doc] }) },
  } as unknown as PayloadRequest
  expect((await getPageByPath(req)).status).toBe(409)
})
