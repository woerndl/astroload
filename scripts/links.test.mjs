import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dirname, 'links.mjs')

function check(files) {
  const dir = mkdtempSync(join(tmpdir(), 'links-'))
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true })
      writeFileSync(join(dir, name), content)
    }
    return spawnSync(process.execPath, [SCRIPT, dir], {
      encoding: 'utf8',
      env: { ...process.env, WEBSITE_URL: 'https://example.com' },
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('passes links to built pages, files and on-demand routes', () => {
  const result = check({
    'en/index.html':
      '<a href="/en/about/">About</a><link href="/favicon.svg"><a href="/preview/en/about?previewSecret=x">Preview</a><a href="/">Root</a><a href="//cdn.example.com/x">CDN</a>',
    'en/about/index.html': '<a href="/en#top">Home</a>',
    'favicon.svg': '<svg/>',
  })
  assert.equal(result.status, 0, result.stderr)
})

test('fails on a link to a page that was not built', () => {
  const result = check({ 'en/index.html': '<a href="/en/missing">Missing</a>' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /\/en\/missing/)
})

test('fails on a path that only starts with the name of an on-demand route', () => {
  const result = check({ 'en/index.html': '<a href="/previews">Previews</a>' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /\/previews/)
})

test('fails on single-quoted, relative and dot-segment links to missing pages', () => {
  for (const href of ["'/en/missing'", '"missing"', '"/preview/../en/missing"']) {
    const result = check({ 'en/index.html': `<a href=${href}>x</a>` })
    assert.equal(result.status, 1, href)
    assert.match(result.stderr, /missing/, href)
  }
})

test('fails on a link to a directory that has no index.html', () => {
  const result = check({
    'en/index.html': '<a href="/en/empty">Empty</a>',
    'en/empty/child/index.html': '<a href="/en">Up</a>',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /\/en\/empty/)
})

test('decodes a percent-encoded path before it looks for the file', () => {
  const result = check({
    'en/index.html': '<a href="/en/caf%C3%A9">Café</a>',
    'en/café/index.html': '<a href="/en">Up</a>',
  })
  assert.equal(result.status, 0, result.stderr)
})

test('resolves a relative link from the page URL without a trailing slash', () => {
  const pages = {
    'en/about/index.html': '<a href="contact">Contact</a>',
    'en/contact/index.html': '<p>Contact</p>',
  }
  assert.equal(check(pages).status, 0)
  const result = check({
    'en/about/index.html': '<a href="team">Team</a>',
    'en/about/team/index.html': '<p>Team</p>',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /team/)
})

test('decodes HTML entities in an href before it resolves the link', () => {
  assert.equal(
    check({ 'en/index.html': '<a href="/files/a&amp;b.pdf">PDF</a>', 'files/a&b.pdf': '%PDF' })
      .status,
    0,
  )
  const result = check({
    'en/index.html': '<a href="/files/a&amp;b.pdf">PDF</a>',
    'files/a&amp;b.pdf': '%PDF',
  })
  assert.equal(result.status, 1)
})

test('checks absolute links with the WEBSITE_URL origin and skips other origins', () => {
  const pages = {
    'en/index.html':
      '<link rel="alternate" hreflang="en" href="https://example.com/en"><a href="https://other.example.org/x">X</a>',
  }
  assert.equal(check(pages).status, 0)
  const result = check({
    'en/index.html': '<link rel="alternate" hreflang="de" href="https://example.com/de/fehlt">',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /\/de\/fehlt/)
})

test('decodes an escaped entity name once', () => {
  const pages = { 'en/index.html': '<a href="/files/a&amp;quot;.pdf">PDF</a>' }
  assert.equal(check({ ...pages, 'files/a&quot;.pdf': '%PDF' }).status, 0)
  assert.equal(check({ ...pages, 'files/a".pdf': '%PDF' }).status, 1)
})
