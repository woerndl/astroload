#!/usr/bin/env node
// Lists upstream commits since the derivation marker's base and, per
// touched file, how the downstream working tree relates to base and target.
// Deciding what to apply is covered in docs/astroload/updating.md.
// Run from the downstream repository root.
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const usage =
  'usage: node scripts/sync-inventory.mjs --upstream <template-clone-path> --to <tag-or-sha> [--format md|json]'

const fail = (msg) => {
  console.error(`sync-inventory: ${msg}`)
  process.exit(1)
}

let opts
try {
  opts = parseArgs({
    options: {
      upstream: { type: 'string' },
      to: { type: 'string' },
      format: { type: 'string', default: 'md' },
      marker: { type: 'string', default: '.astroload.yml' },
    },
  }).values
} catch (err) {
  fail(`${err.message}\n${usage}`)
}
if (!opts.upstream || !opts.to) fail(usage)
if (opts.format !== 'md' && opts.format !== 'json') fail(`unknown --format '${opts.format}'`)

// ponytail: quotePath=off keeps non-ASCII paths unescaped. Paths containing
// tabs, quotes, or newlines stay unsupported until this parses -z output
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, '-c', 'core.quotePath=off', ...args], { encoding: 'utf8' }).trimEnd()
const tryGit = (cwd, ...args) => {
  try {
    return git(cwd, ...args)
  } catch {
    return null
  }
}

const up = opts.upstream
if (tryGit(up, 'rev-parse', '--is-inside-work-tree') === null)
  fail(`--upstream '${up}' is not a git checkout`)

if (!existsSync(opts.marker))
  fail(`no ${opts.marker} here. Run from the derived project's root`)
const markerSha = /^upstream_commit:\s*([0-9a-f]{7,40})\s*$/m.exec(readFileSync(opts.marker, 'utf8'))?.[1]
if (!markerSha) fail(`${opts.marker} has no usable 'upstream_commit: <sha>' line`)
// resolve to the full sha so the JSON `base` is always full-length
const base = tryGit(up, 'rev-parse', '--verify', '--quiet', `${markerSha}^{commit}`)
if (base === null)
  fail(`upstream_commit ${markerSha} not found in ${up}. Fetch the template clone or check the --upstream path`)
const target = tryGit(up, 'rev-parse', '--verify', '--quiet', `${opts.to}^{commit}`)
if (target === null) fail(`--to '${opts.to}' not found in ${up}`)
if (tryGit(up, 'merge-base', '--is-ancestor', base, target) === null)
  fail(`${base} is not an ancestor of ${opts.to}. The marker commit must precede the target`)

// name-status lines: "M\tpath" or "R100\told\tnew"
const parseNameStatus = (raw) =>
  raw
    ? raw.split('\n').map((line) => {
        const [status, a, b] = line.split('\t')
        return b === undefined
          ? { status: status[0], path: a }
          : { status: status[0], path: b, from: a }
      })
    : []

const commits = git(up, 'log', '--reverse', '--format=%H\x1f%s', `${base}..${target}`)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, subject] = line.split('\x1f')
    return {
      sha,
      subject,
      // ponytail: one git call per commit and 2-3 per file below. Fine for
      // tens of commits, switch to `git cat-file --batch-check` if it gets slow
      files: parseNameStatus(git(up, 'diff-tree', '-r', '-M', '--no-commit-id', '--name-status', sha)),
    }
  })

const blob = (rev, path) => tryGit(up, 'rev-parse', '--verify', '--quiet', `${rev}:${path}`)
const UPSTREAM = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied', T: 'retyped' }

const files = parseNameStatus(git(up, 'diff', '--name-status', '-M', base, target)).map((f) => {
  // hash only regular files. A directory or symlink at the path would make
  // hash-object throw, so anything else reports as diverged
  const stat = lstatSync(f.path, { throwIfNoEntry: false })
  const local = stat?.isFile() ? git('.', 'hash-object', '--', f.path) : null
  const downstream =
    stat && !stat.isFile() ? 'diverged'
    : local === null && f.status === 'D' ? 'matches target'
    : local === null && f.status === 'R' && existsSync(f.from) ? `still at ${f.from}`
    : local === null ? 'missing'
    : local === blob(target, f.path) ? 'matches target'
    : local === blob(base, f.from ?? f.path) ? 'matches base'
    : 'diverged'
  return { path: f.path, ...(f.from && { from: f.from }), upstream: UPSTREAM[f.status] ?? f.status, downstream }
})

if (opts.format === 'json') {
  console.log(JSON.stringify({ base, target, to: opts.to, commits, files }, null, 2))
} else {
  const short = (sha) => sha.slice(0, 7)
  const arrow = (f) => (f.from ? `${f.from} -> ${f.path}` : f.path)
  console.log(
    [
      `# Sync inventory: ${short(base)} -> ${opts.to} (${short(target)})`,
      '',
      `${commits.length} commits, ${files.length} files changed net.`,
      'Downstream states: `matches base` = matches the base version.',
      '`matches target` = matches the target version. `diverged` = differs',
      'from both. `missing` = absent here. `still at <old path>` = the',
      'upstream rename is not applied here.',
      '',
      '## Files (net, base -> target)',
      '',
      '| file | upstream | downstream |',
      '| --- | --- | --- |',
      ...files.map((f) => `| ${arrow(f)} | ${f.upstream} | ${f.downstream} |`),
      '',
      '## Commits (oldest first)',
      '',
      ...commits.flatMap((c) => [
        `- \`${short(c.sha)}\` ${c.subject}`,
        ...c.files.map((f) => `  - ${f.status} ${arrow(f)}`),
      ]),
    ].join('\n'),
  )
}
