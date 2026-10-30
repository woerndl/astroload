import { DEFAULT_LOCALE } from '@astroload/cms/src/site-config.ts'

import { env, expect, test } from './fixtures'

test('a draft save sends no deploy webhook POST and a publish sends one', async ({
  admin,
  cleanup,
  receiver,
}) => {
  test.skip(!env.deployHookUrl, 'DEPLOY_HOOK_URL is unset in cms/.env')
  // The CMS sends at most one deploy webhook POST in five minutes.
  test.setTimeout(330_000)
  const hook = await receiver(env.deployHookUrl)
  const created = await admin.post(`/api/pages?locale=${DEFAULT_LOCALE}&draft=true`, {
    data: { title: 'E2E deploy webhook', slug: 'e2e-deploy-webhook', _status: 'draft' },
  })
  await expect(created).toBeOK()
  const { doc } = await created.json()
  cleanup(() => admin.delete(`/api/pages/${doc.id}`))

  // The CMS sends the POST without waiting for it, so give a wrong one time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  expect(hook.requests, 'the draft save sent a deploy webhook POST').toHaveLength(0)

  const published = await admin.patch(`/api/pages/${doc.id}?locale=${DEFAULT_LOCALE}`, {
    data: { _status: 'published' },
  })
  await expect(published).toBeOK()
  await expect
    .poll(() => hook.requests.length, {
      timeout: 310_000,
      message: 'the publish sent no deploy webhook POST',
    })
    .toBe(1)
  expect(hook.requests[0]).toMatchObject({ method: 'POST', url: hook.url.pathname })
})
