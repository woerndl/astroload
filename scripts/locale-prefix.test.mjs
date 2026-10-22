import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dirname, 'locale-prefix.mjs')

function check(files) {
  const dir = mkdtempSync(join(tmpdir(), 'locale-prefix-'))
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true })
      writeFileSync(join(dir, name), content)
    }
    return spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('passes a build with single locale prefixes', () => {
  const result = check({
    'en/about/index.html': '<a href="/en/about">About</a><a href="/de">Deutsch</a>',
  })
  assert.equal(result.status, 0, result.stderr)
})

test('fails on a doubled prefix in a nested file', () => {
  const result = check({
    'en/index.html': '<a href="/en">Home</a>',
    'en/about/index.html': '<a href="/en/en/about">About</a>',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /\/en\/en/)
})

test('fails on a doubled prefix at the end of a sitemap URL', () => {
  const result = check({ 'sitemap.xml': '<loc>https://example.com/de/de</loc>' })
  assert.equal(result.status, 1)
})

test('fails on a doubled prefix in a server chunk', () => {
  const result = check({ 'server/chunks/page.mjs': 'const href = "/de/de/kontakt"' })
  assert.equal(result.status, 1)
})
