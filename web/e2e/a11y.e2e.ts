import { DEFAULT_LOCALE } from '@astroload/cms/src/site-config.ts'

import { shellLabels } from '../src/layout/shellLabels'
import { env, expect, home, test } from './fixtures'

test('the first Tab focuses the skip link and Enter moves focus to main', async ({ page }) => {
  await page.goto(`${env.websiteUrl}${home}`)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: shellLabels(DEFAULT_LOCALE).skipToContent })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
})
