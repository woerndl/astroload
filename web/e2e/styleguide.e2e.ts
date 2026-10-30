import AxeBuilder from '@axe-core/playwright'

import { env, expect, test } from './fixtures'

test('the styleguide passes the axe wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice rules', async ({
  page,
}) => {
  await page.goto(`${env.websiteUrl}/styleguide`)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
})
