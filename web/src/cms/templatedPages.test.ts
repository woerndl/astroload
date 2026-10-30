import { expect, it } from 'vitest'

import { missingTemplates } from './templatedPages'
import type { Locale } from './types'

const [one, two] = ['en', 'de'] as Locale[]

it('lists each template without a published path per locale', () => {
  const items = [
    { template: 'home', paths: { [one]: '/' } },
    { template: 'default', paths: { [one]: '/about' } },
  ]
  expect(missingTemplates(items, ['home', 'search'], [one, two])).toEqual([
    `home (${two})`,
    `search (${one})`,
    `search (${two})`,
  ])
})
