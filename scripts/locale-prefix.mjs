import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LOCALES } from '../cms/src/site-config.ts'

// Fails on a doubled locale prefix such as /en/en/ in the built site. It
// appears when localePath() gets a stored path that already carries its
// locale. A page whose slug equals its locale is built at that path and passes.
const dir = process.argv[2] ?? join(import.meta.dirname, '../web/dist')
const doubled = new RegExp(`/(${LOCALES.join('|')})/\\1(?=[/"'<?#\\s]|$)`, 'gm')

const hits = []
for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(html|xml|txt|js|mjs|json)$/.test(entry.name)) continue
  const file = join(entry.parentPath, entry.name)
  for (const [path] of readFileSync(file, 'utf8').matchAll(doubled)) {
    if (!existsSync(join(dir, 'client', path, 'index.html'))) hits.push(`${file}: ${path}`)
  }
}

if (hits.length > 0) {
  console.error(`Doubled locale prefix in ${dir}:\n${hits.join('\n')}`)
  process.exit(1)
}
