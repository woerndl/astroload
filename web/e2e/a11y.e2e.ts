import { env, expect, test } from './fixtures'

test('the first Tab focuses the skip link and Enter moves focus to main', async ({ page }) => {
  await page.goto(`${env.websiteUrl}/en`)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
})
