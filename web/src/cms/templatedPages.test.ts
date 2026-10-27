import { expect, it } from 'vitest'

import type { PageByPathResult } from './getPageByPath'
import { isTemplatedPage, missingTemplates } from './templatedPages'

it('lists each template without a published path per locale', () => {
  const items = [
    { template: 'home', paths: { en: '/en', de: '/de' } },
    { template: 'contact', paths: { en: '/en/contact' } },
    { template: 'default', paths: { en: '/en/about' } },
  ]
  expect(missingTemplates(items, ['home', 'contact', 'search'], ['en', 'de'])).toEqual([
    'contact (de)',
    'search (en)',
    'search (de)',
  ])
})

it('treats only a Pages document with a template other than default as templated', () => {
  const result = (collection: string, template?: string) =>
    ({ collection, data: { template } }) as unknown as PageByPathResult
  expect(
    [
      result('pages', 'home'),
      result('pages', 'default'),
      result('pages'),
      result('posts', 'home'),
    ].map(isTemplatedPage),
  ).toEqual([true, false, false, false])
})
