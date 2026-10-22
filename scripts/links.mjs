import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseEnv } from 'node:util'

// Fails on an internal href in the built HTML that resolves to no built file.
// Routes rendered on demand have no file, so they are listed here. Each listed
// route other than / also covers its subpaths, but a longer name such as
// /previews does not match.
const ON_DEMAND = ['/', '/preview']

const dir = process.argv[2] ?? join(import.meta.dirname, '../web/dist/client')
const ORIGIN = 'http://site.invalid'

// SEOMetadata.astro writes the canonical and hreflang links with the WEBSITE_URL origin.
const envFile = join(import.meta.dirname, '../web/.env')
const websiteUrl =
  process.env.WEBSITE_URL ??
  (existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')).WEBSITE_URL : undefined)
const siteOrigins = new Set([ORIGIN, ...(websiteUrl ? [new URL(websiteUrl).origin] : [])])

const onDemand = (path) =>
  ON_DEMAND.some((route) => path === route || (route !== '/' && path.startsWith(`${route}/`)))

const isFile = (path) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false

// web/astro.config.mjs sets trailingSlash: 'never', so en/about/index.html
// serves /en/about, and a relative link on it resolves from /en/.
function pagePath(file) {
  const path = `/${relative(dir, file).split('\\').join('/')}`
  return path.endsWith('/index.html') ? path.slice(0, -'/index.html'.length) || '/' : path
}

const unescapeHtml = (value) =>
  value.replace(/&(amp|quot);/g, (_, name) => (name === 'amp' ? '&' : '"'))

function decode(pathname) {
  try {
    return decodeURI(pathname)
  } catch {
    return pathname
  }
}

const misses = []
for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue
  const file = join(entry.parentPath, entry.name)
  const base = new URL(pagePath(file), ORIGIN)
  for (const [, , href] of readFileSync(file, 'utf8').matchAll(/\shref\s*=\s*(["'])(.*?)\1/g)) {
    const url = new URL(unescapeHtml(href), base)
    if (!siteOrigins.has(url.origin)) continue
    const raw = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname
    if (onDemand(raw)) continue
    const path = decode(raw)
    if (![path, join(path, 'index.html'), `${path}.html`].some((p) => isFile(join(dir, p)))) {
      misses.push(`${file}: ${href}`)
    }
  }
}

if (misses.length > 0) {
  console.error(`Internal links without a built file in ${dir}:\n${misses.join('\n')}`)
  process.exit(1)
}
