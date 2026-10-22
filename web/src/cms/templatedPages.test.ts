import { describe, expect, it } from 'vitest'

import type { PageByPathResult } from './getPageByPath'
import { isTemplatedPage, missingTemplates } from './templatedPages'

describe('missingTemplates', () => {
  const items = [
    { template: 'home', paths: { en: '/en', de: '/de' } },
    { template: 'contact', paths: { en: '/en/contact' } },
    { template: 'default', paths: { en: '/en/about' } },
  ]

  it('lists each template without a published path per locale', () => {
    expect(missingTemplates(items, ['home', 'contact', 'search'], ['en', 'de'])).toEqual([
      'contact (de)',
      'search (en)',
      'search (de)',
    ])
  })

  it('returns an empty list when every template has a path in every locale', () => {
    expect(missingTemplates(items, ['home'], ['en', 'de'])).toEqual([])
  })
})

describe('isTemplatedPage', () => {
  const page = (template?: string) =>
    ({ collection: 'pages', data: { template } }) as unknown as PageByPathResult

  it('is true only for a Pages document with a template other than default', () => {
    expect(isTemplatedPage(page('home'))).toBe(true)
    expect(isTemplatedPage(page('default'))).toBe(false)
    expect(isTemplatedPage(page(undefined))).toBe(false)
    expect(isTemplatedPage({ collection: 'posts', data: {} } as unknown as PageByPathResult)).toBe(
      false,
    )
  })
})
