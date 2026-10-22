import { env, expect, test } from './fixtures'

// Needs DEPLOY_HOOK_URL in cms/.env set to a loopback URL, for example
// http://127.0.0.1:4322/deploy, and a CMS that has sent no deploy webhook POST
// in the last five minutes.
test('a draft save sends no deploy webhook POST and a publish sends one', async ({
  admin,
  create,
  receiver,
}) => {
  test.skip(!env.deployHookUrl, 'DEPLOY_HOOK_URL is unset in cms/.env')
  const hook = await receiver(env.deployHookUrl)
  const page = await create<{ id: string }>('pages?locale=en&draft=true', {
    data: { title: 'E2E deploy webhook', slug: 'e2e-deploy-webhook', _status: 'draft' },
  })

  // The CMS sends the POST without waiting for it, so give a wrong one time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  expect(hook.requests, 'the draft save sent a deploy webhook POST').toHaveLength(0)

  expect(
    (
      await admin.patch(`/api/pages/${page.id}?locale=en`, { data: { _status: 'published' } })
    ).status(),
  ).toBe(200)
  await expect
    .poll(() => hook.requests.length, {
      timeout: 10_000,
      message:
        'no deploy webhook POST arrived within 10 s. The likely cause is a deploy webhook POST in the last five minutes, which holds further POSTs until the window closes. Restart the CMS and rerun',
    })
    .toBe(1)
  expect(hook.requests[0]).toMatchObject({
    method: 'POST',
    url: hook.url.pathname,
    body: '{"trigger":"cms-change"}',
  })
})
