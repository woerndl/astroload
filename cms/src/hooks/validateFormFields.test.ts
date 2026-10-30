import { expect, it } from 'vitest'

import { validateFormFields } from './validateFormFields'

it('rejects a fields value that is not a list with status 400', async () => {
  for (const fields of [{}, 5]) {
    await expect(async () =>
      validateFormFields({ data: { title: 'x', fields } } as never),
    ).rejects.toMatchObject({ status: 400 })
  }
})
