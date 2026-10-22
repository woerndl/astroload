// Headers passed to writeHead replace a header set with setHeader, and Astro
// passes its Content-Security-Policy that way when security.csp is on. So the
// wrapper applies those headers itself, adds the policy, and calls the
// original writeHead without headers. Node also calls writeHead for implicit
// headers, so wrapping it adds the policy to every response.
/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} policy
 */
export function sendFrameAncestors(res, policy) {
  const writeHead = res.writeHead
  /** @type {typeof res.writeHead} */
  res.writeHead = function (statusCode, ...rest) {
    const message = typeof rest[0] === 'string' ? rest.shift() : undefined
    const headers = rest[0]
    if (Array.isArray(headers)) {
      for (let i = 0; i < headers.length; i += 2) res.removeHeader(headers[i])
      for (let i = 0; i < headers.length; i += 2) res.appendHeader(headers[i], headers[i + 1])
    } else if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        if (value !== undefined) res.setHeader(name, value)
      }
    }
    const current = res.getHeader('Content-Security-Policy')
    const values = current === undefined ? [] : [current].flat().map(String)
    if (!values.includes(policy)) res.setHeader('Content-Security-Policy', [...values, policy])
    return message === undefined
      ? writeHead.call(this, statusCode)
      : writeHead.call(this, statusCode, message)
  }
}
