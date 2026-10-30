import { expect, it } from 'vitest'

import { missingTemplates } from './templatedPages'

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
