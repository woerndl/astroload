import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, it } from 'vitest'

it('the security.csp block lists the hash of the inline layer statement', () => {
  const component = readFileSync(new URL('./LayerOrder.astro', import.meta.url), 'utf8')
  const statement = component.match(/<style is:inline>([^<]*)<\/style>/)?.[1]
  expect(statement).toBeTruthy()
  const hash = createHash('sha256').update(statement!).digest('base64')
  expect(readFileSync(new URL('../../astro.config.mjs', import.meta.url), 'utf8')).toContain(
    `'sha256-${hash}'`,
  )
})
