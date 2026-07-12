import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dirname, 'sync-inventory.mjs')
// the non-ASCII filename checks that quotePath=off keeps paths unescaped

const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
}
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env }).trimEnd()
const run = (cwd, args) => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd, env })

let dir, up, down, baseSha
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'sync-inventory-'))
  up = join(dir, 'upstream')
  down = join(dir, 'downstream')

  mkdirSync(up)
  git(up, 'init', '-q', '-b', 'main')
  writeFileSync(join(up, 'mod-clean.txt'), 'base\n')
  writeFileSync(join(up, 'mod-diverged.txt'), 'base\n')
  writeFileSync(join(up, 'mod-gone-local.txt'), 'base\n')
  writeFileSync(join(up, 'del-upstream.txt'), 'base\n')
  writeFileSync(join(up, 'del-ported.txt'), 'base\n')
  writeFileSync(join(up, 'übergabe.txt'), 'base\n')
  writeFileSync(join(up, 'becomes-dir.txt'), 'base\n')
  writeFileSync(join(up, 'old-name.txt'), 'stable content\n')
  git(up, 'add', '.')
  git(up, 'commit', '-q', '-m', 'base')
  baseSha = git(up, 'rev-parse', 'HEAD')

  // independent downstream repo built from the base files, no shared history
  const gitDir = join(up, '.git')
  cpSync(up, down, { recursive: true, filter: (src) => src !== gitDir && !src.startsWith(gitDir + '/') })
  git(down, 'init', '-q')
  // abbreviated, the script must resolve it to the full sha
  writeFileSync(join(down, '.astroload.yml'), `upstream_commit: ${baseSha.slice(0, 12)}\nupstream_release: v-base\n`)

  writeFileSync(join(up, 'mod-clean.txt'), 'target\n')
  writeFileSync(join(up, 'mod-diverged.txt'), 'target\n')
  writeFileSync(join(up, 'mod-gone-local.txt'), 'target\n')
  writeFileSync(join(up, 'übergabe.txt'), 'target\n')
  writeFileSync(join(up, 'becomes-dir.txt'), 'target\n')
  writeFileSync(join(up, 'added.txt'), 'brand new\n')
  git(up, 'rm', '-q', 'del-upstream.txt', 'del-ported.txt')
  git(up, 'mv', 'old-name.txt', 'new-name.txt')
  git(up, 'add', '.')
  git(up, 'commit', '-q', '-m', 'update all fixture files')
  git(up, 'tag', 'v-test')

  writeFileSync(join(down, 'mod-diverged.txt'), 'local divergence\n')
  rmSync(join(down, 'mod-gone-local.txt'))
  rmSync(join(down, 'del-ported.txt'))
  writeFileSync(join(down, 'added.txt'), 'brand new\n')
  rmSync(join(down, 'becomes-dir.txt'))
  mkdirSync(join(down, 'becomes-dir.txt'))
})
after(() => dir && rmSync(dir, { recursive: true, force: true }))

test('reports downstream state for each net-changed file', () => {
  const out = JSON.parse(run(down, ['--upstream', up, '--to', 'v-test', '--format', 'json']))
  const state = Object.fromEntries(out.files.map((f) => [f.path, f.downstream]))
  assert.equal(state['mod-clean.txt'], 'matches base')
  assert.equal(state['mod-diverged.txt'], 'diverged')
  assert.equal(state['mod-gone-local.txt'], 'missing')
  assert.equal(state['del-upstream.txt'], 'matches base')
  assert.equal(state['del-ported.txt'], 'matches target')
  assert.equal(state['übergabe.txt'], 'matches base')
  assert.equal(state['becomes-dir.txt'], 'diverged')
  assert.equal(state['added.txt'], 'matches target')
  assert.equal(state['new-name.txt'], 'still at old-name.txt')
  assert.equal(out.base, baseSha)
  assert.equal(out.commits.length, 1)
  assert.equal(out.commits[0].subject, 'update all fixture files')
  assert.equal(out.commits[0].files.length, 9)
})

test('markdown output carries file states and commit subjects', () => {
  const out = run(down, ['--upstream', up, '--to', 'v-test'])
  assert.match(out, /\| added\.txt \| added \| matches target \|/)
  assert.match(out, /update all fixture files/)
})

test('errors without a marker', () => {
  assert.throws(
    () => run(dir, ['--upstream', up, '--to', 'v-test']),
    (err) => err.status === 1 && /sync-inventory: no \.astroload\.yml/.test(err.stderr),
  )
})

test('errors on a placeholder marker', () => {
  const bare = join(dir, 'bare')
  mkdirSync(bare, { recursive: true })
  writeFileSync(join(bare, '.astroload.yml'), 'upstream_commit: REPLACE-WITH-SCAFFOLD-COMMIT-SHA\n')
  assert.throws(() => run(bare, ['--upstream', up, '--to', 'v-test']), /no usable 'upstream_commit/)
})

test('errors on an unknown target', () => {
  assert.throws(() => run(down, ['--upstream', up, '--to', 'v-nope']), /not found/)
})
