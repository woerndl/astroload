import { describe, expect, it } from 'vitest'

import { staleOnError } from './staleOnError'

// Each test uses a distinct key so the module-level last-good cache does not
// bleed between cases.
describe('staleOnError', () => {
  it('returns fresh data and records it as the last good value', async () => {
    const result = await staleOnError('fresh', async () => 1)
    expect(result).toEqual({ data: 1, stale: false })
  })

  it('serves the last good value when a later fetch fails', async () => {
    await staleOnError('hot', async () => 'good')
    const result = await staleOnError('hot', async () => {
      throw new Error('CMS down')
    })
    expect(result).toEqual({ data: 'good', stale: true })
  })

  it('rethrows on a cold start with no prior value', async () => {
    await expect(
      staleOnError('cold', async () => {
        throw new Error('CMS down')
      }),
    ).rejects.toThrow('CMS down')
  })

  it('keeps the most recent successful value', async () => {
    await staleOnError('refresh', async () => 'v1')
    await staleOnError('refresh', async () => 'v2')
    const result = await staleOnError('refresh', async () => {
      throw new Error('down')
    })
    expect(result.data).toBe('v2')
  })
})
