import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALE_URL_PREFIX } from '../cms/types'
import { localePath } from './localePath'

const prefix = LOCALE_URL_PREFIX ? `/${DEFAULT_LOCALE}` : ''

describe('localePath', () => {
  it('prefixes a path written in code per the URL prefix setting', () => {
    expect(localePath(DEFAULT_LOCALE, '/example')).toBe(`${prefix}/example`)
    expect(localePath(DEFAULT_LOCALE, 'example')).toBe(`${prefix}/example`)
  })

  it('maps the root path to the locale home', () => {
    expect(localePath(DEFAULT_LOCALE, '/')).toBe(prefix || '/')
  })
})
