import { describe, expect, it } from 'vitest'

import { aliasRedirect } from './aliasRedirect.mjs'

const env = {
  ALIAS_REDIRECT_HOSTS: 'web-production.up.railway.app, Example.net',
  ALIAS_REDIRECT_ORIGIN: 'https://www.example.com',
}

describe('aliasRedirect', () => {
  it('returns null when ALIAS_REDIRECT_HOSTS is unset', () => {
    expect(aliasRedirect({})).toBeNull()
  })

  it('redirects a listed alias to the origin with path and query, 302 by default', () => {
    expect(aliasRedirect(env)('web-production.up.railway.app', '/en/about?x=1')).toEqual({
      status: 302,
      location: 'https://www.example.com/en/about?x=1',
    })
  })

  it('answers 301 when ALIAS_REDIRECT_PERMANENT is 1 or true, else 302', () => {
    expect(
      aliasRedirect({ ...env, ALIAS_REDIRECT_PERMANENT: '1' })('example.net', '/')?.status,
    ).toBe(301)
    expect(
      aliasRedirect({ ...env, ALIAS_REDIRECT_PERMANENT: 'true' })('example.net', '/')?.status,
    ).toBe(301)
    expect(
      aliasRedirect({ ...env, ALIAS_REDIRECT_PERMANENT: '0' })('example.net', '/')?.status,
    ).toBe(302)
  })

  it('does not redirect without the header, for the origin host, or for an unlisted host', () => {
    const redirect = aliasRedirect({
      ...env,
      ALIAS_REDIRECT_HOSTS: `${env.ALIAS_REDIRECT_HOSTS},www.example.com`,
    })
    expect(redirect(undefined, '/')).toBeNull()
    expect(redirect('', '/')).toBeNull()
    expect(redirect('www.example.com', '/')).toBeNull()
    expect(redirect('other.example.org', '/')).toBeNull()
  })

  it('normalizes case, port and a trailing dot, and reads the first value of a list', () => {
    const redirect = aliasRedirect(env)
    expect(redirect('EXAMPLE.NET:443', '/')).not.toBeNull()
    expect(redirect('example.net.', '/')).not.toBeNull()
    expect(redirect('example.net, www.example.com', '/')).not.toBeNull()
    expect(redirect('www.example.com, example.net', '/')).toBeNull()
  })

  it('ignores a trailing dot on the listed hosts and on the origin', () => {
    const redirect = aliasRedirect({
      ALIAS_REDIRECT_HOSTS: 'www.example.com, example.net.',
      ALIAS_REDIRECT_ORIGIN: 'https://www.example.com.',
    })
    expect(redirect('www.example.com', '/')).toBeNull()
    expect(redirect('example.net', '/')).not.toBeNull()
  })

  it('throws when ALIAS_REDIRECT_ORIGIN is missing or not http or https', () => {
    expect(() => aliasRedirect({ ALIAS_REDIRECT_HOSTS: 'example.net' })).toThrow(
      'ALIAS_REDIRECT_ORIGIN',
    )
    for (const origin of [
      'file:///tmp/site',
      'mailto:admin@example.com',
      'ftp://www.example.com',
    ]) {
      expect(() =>
        aliasRedirect({ ALIAS_REDIRECT_HOSTS: 'example.net', ALIAS_REDIRECT_ORIGIN: origin }),
      ).toThrow('http or https')
    }
  })
})
