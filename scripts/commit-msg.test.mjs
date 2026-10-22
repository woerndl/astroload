import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const hook = new URL('../.githooks/commit-msg', import.meta.url).pathname
const dir = mkdtempSync(join(tmpdir(), 'commit-msg-'))

function accepts(message) {
  const file = join(dir, 'msg')
  writeFileSync(file, message)
  return spawnSync(hook, [file]).status === 0
}

test('accepts a known type with an optional scope or breaking marker, also after comment lines', () => {
  assert.ok(accepts('feat: add a page\n'))
  assert.ok(accepts('fix(cms): keep the CMS draft flag\n'))
  assert.ok(accepts('feat(cms)!: default to mongodb\n'))
  assert.ok(accepts('# comment\n\ndocs: explain the hook\n'))
})

test('rejects an unknown type, a subject that starts with an upper-case letter or white space, and a missing space', () => {
  assert.ok(!accepts('wip: add a page\n'))
  assert.ok(!accepts('Feat: add a page\n'))
  assert.ok(!accepts('feat: Add a page\n'))
  assert.ok(!accepts('feat: \tadd a page\n'))
  assert.ok(!accepts('feat:add a page\n'))
})

test('accepts 72 characters and rejects 73', () => {
  assert.ok(accepts(`fix: ${'a'.repeat(67)}\n`))
  assert.ok(!accepts(`fix: ${'a'.repeat(68)}\n`))
})

test('rejects a trailing full stop', () => {
  assert.ok(!accepts('fix: add a page.\n'))
})

test('accepts the merge, revert and reapply subjects Git writes and rejects look-alikes', () => {
  assert.ok(accepts("Merge branch 'release' into main\n"))
  assert.ok(accepts("Merge remote-tracking branch 'origin/main'\n"))
  assert.ok(accepts("Merge branch 'main' of github.com:example/site into lane/a\n"))
  assert.ok(accepts("Merge branches 'a' and 'b'\n"))
  assert.ok(accepts("Merge tags 'v1' and 'v2'\n"))
  assert.ok(accepts("Merge remote-tracking branches 'origin/a' and 'origin/b'\n"))
  assert.ok(accepts("Merge branch 'a', tag 'v1'\n"))
  assert.ok(accepts("Merge branch 'release/o'clock' into main\n"))
  assert.ok(accepts("Merge commit '0123abc'\n"))
  assert.ok(accepts('Revert "feat: add a page"\n'))
  assert.ok(accepts('Reapply "feat: add a page"\n'))
  assert.ok(!accepts('Merge arbitrary subject.\n'))
  assert.ok(!accepts("Merge branch 'arbitrary subject\n"))
  assert.ok(!accepts("Merge branch 'release'.\n"))
  assert.ok(!accepts("Merge branch ''\n"))
  assert.ok(!accepts("Merge branch 'release' arbitrary text\n"))
  assert.ok(!accepts("Merge branch 'release' arbitrary text 'x'\n"))
  assert.ok(!accepts("Merge branch 'a b'\n"))
  assert.ok(!accepts('Revert "arbitrary".\n'))
})
