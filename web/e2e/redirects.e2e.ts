import { stripLocalePath } from '@astroload/cms/src/stripLocalePath.ts'

import { expect, readKey, test } from './fixtures'

type Redirect = { sourcePath: string; destinationPath: string; type: 'permanent' | 'temporary' }

// The web build reads the Redirects documents at build time, so a document
// created or changed after the build fails here until the next build.
test("the built web app redirects each Redirects document's source path with its status and destination", async ({
  cms,
  web,
}) => {
  const res = await cms.get('/api/redirects?pagination=false', { headers: readKey })
  await expect(res).toBeOK()
  const { docs }: { docs: Redirect[] } = await res.json()
  test.skip(
    docs.length === 0,
    'no Redirects document exists. Create one in the admin and rebuild the web app',
  )

  for (const redirect of docs) {
    const source = stripLocalePath(redirect.sourcePath)
    const hit = await web.get(source)
    expect(hit.status(), source).toBe(redirect.type === 'permanent' ? 301 : 302)
    expect(hit.headers()['location'], source).toBe(stripLocalePath(redirect.destinationPath))
  }
})
