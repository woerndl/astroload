import { expect, it } from 'vitest'

import { staleOnError } from './staleOnError'

const down = async () => {
  throw new Error('CMS down')
}

it('serves the most recent good value as stale when a later fetch fails', async () => {
  expect(await staleOnError('hot', async () => 'v1')).toEqual({ data: 'v1', stale: false })
  await staleOnError('hot', async () => 'v2')
  expect(await staleOnError('hot', down)).toEqual({ data: 'v2', stale: true })
})

it('rethrows when no fetch for the key has succeeded yet', async () => {
  await expect(staleOnError('cold', down)).rejects.toThrow('CMS down')
})
