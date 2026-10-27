import { expect, it } from 'vitest'

import { aliasRedirect } from './aliasRedirect.mjs'

const env = {
  ALIAS_REDIRECT_HOSTS: 'web-production.up.railway.app, Example.net., www.example.com',
  ALIAS_REDIRECT_ORIGIN: 'https://www.example.com',
}

it('returns null when ALIAS_REDIRECT_HOSTS is unset', () => {
  expect(aliasRedirect({})).toBeNull()
})

it('redirects a listed alias to the origin with path and query, 302 unless permanent is 1 or true', () => {
  const location = 'https://www.example.com/en/about?x=1'
  for (const [permanent, status] of [
    [undefined, 302],
    ['0', 302],
    ['1', 301],
    ['true', 301],
  ]) {
    const redirect = aliasRedirect({ ...env, ALIAS_REDIRECT_PERMANENT: permanent })
    expect(redirect('web-production.up.railway.app', '/en/about?x=1')).toEqual({ status, location })
  }
})

it.each([
  ['EXAMPLE.NET:443', true],
  ['example.net.', true],
  ['example.net, www.example.com', true],
  ['www.example.com, example.net', false],
  ['www.example.com', false],
  ['other.example.org', false],
  ['', false],
  [undefined, false],
])('host %s redirects: %s', (host, redirects) => {
  const redirect = aliasRedirect({ ...env, ALIAS_REDIRECT_ORIGIN: 'https://www.example.com.' })
  expect(redirect(host, '/') !== null).toBe(redirects)
})

it.each([undefined, 'file:///tmp/site', 'mailto:admin@example.com', 'ftp://www.example.com'])(
  'throws when ALIAS_REDIRECT_ORIGIN is %s',
  (origin) => {
    expect(() =>
      aliasRedirect({ ALIAS_REDIRECT_HOSTS: 'example.net', ALIAS_REDIRECT_ORIGIN: origin }),
    ).toThrow('ALIAS_REDIRECT_ORIGIN')
  },
)
