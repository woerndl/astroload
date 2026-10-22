/** @param {Record<string, string | undefined>} env */
export function aliasRedirect(env) {
  const hosts = (env.ALIAS_REDIRECT_HOSTS ?? '').split(',').map(normalizeHost).filter(Boolean)
  if (hosts.length === 0) return null
  if (!env.ALIAS_REDIRECT_ORIGIN)
    throw new Error('ALIAS_REDIRECT_HOSTS needs ALIAS_REDIRECT_ORIGIN')
  const origin = new URL(env.ALIAS_REDIRECT_ORIGIN)
  if (origin.protocol !== 'https:' && origin.protocol !== 'http:') {
    throw new Error('ALIAS_REDIRECT_ORIGIN must be an http or https URL')
  }
  const aliases = new Set(hosts.filter((host) => host !== normalizeHost(origin.hostname)))
  const status = ['1', 'true'].includes(env.ALIAS_REDIRECT_PERMANENT ?? '') ? 301 : 302

  /**
   * @param {string | string[] | undefined} forwardedHost
   * @param {string | undefined} url
   */
  return (forwardedHost, url) => {
    if (typeof forwardedHost !== 'string') return null
    if (!aliases.has(normalizeHost(forwardedHost.split(',')[0]))) return null
    return { status, location: origin.origin + (url || '/') }
  }
}

/** @param {string} host */
function normalizeHost(host) {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
}
