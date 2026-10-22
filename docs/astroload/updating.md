# Updating a derived project

How to pull template changes into a project scaffolded from astroload.
This runs in the downstream repo. Making a release of the template itself
is covered in [maintenance.md](./maintenance.md).

Changes are reviewed commit by commit and applied by hand. The workflow
does not merge or cherry-pick, because most upstream commits need
adaptation.

## Before you start

- Clean working tree in the downstream repo.
- A local clone of the template, fetched up to the release or commit you
  target.
- `.astroload.yml` in the downstream root records the template commit the
  project was scaffolded from, or last synced to. If the file is missing,
  or still holds the scaffold placeholder values, recover that commit from
  project history and set the marker before continuing.

## 1. Run the inventory script

    node ../astroload/scripts/sync-inventory.mjs --upstream ../astroload --to <tag>

The script is part of the template, so run the upstream clone's copy: a
project scaffolded before the script existed does not have it, and the
upstream copy is current either way.

This lists every upstream commit since the base and, for each net-changed
file, one of five states:

- `matches base`: the file here matches the base version.
- `matches target`: the file here matches the target version. For an
  upstream deletion this means the file is already absent.
- `diverged`: the file here differs from both versions.
- `missing`: the path does not exist in this project.
- `still at <old path>`: an upstream rename not yet applied here. The new
  path is absent and the old file still present.

Use `--format json` for tooling.

The rename state checks the new path first. A rename applied here with a
copy left behind at the old path reports `matches target`. Remove the old
file when applying the rename.

The script reports file and commit state only. Step 2 decides whether a
change applies to this project.

## 2. Classify each commit, then apply

Before classifying, read the upgrade notes in the exact range:

    git -C ../astroload diff <base>..<target> -- docs/astroload/CHANGELOG.md

Nested `**Upgrade notes:**` bullets describe work the upstream diff
alone may not show: a search for the same bug in code this project
added itself, a query to run on existing data first, a condition under
which the change does not apply, or a behavior to compare before and
after. They guide review and verification. They do not decide whether a
change applies or which verdict it gets. When syncing to an untagged
commit, notes still under `## [Unreleased]` may change later, so read
them from the range diff above, not from the current file.

Review each commit with `git -C ../astroload show <sha>`. Changelog
entries are summaries, so classify from the commit diff. Assign one
verdict per commit:

- PULL: apply the upstream change unchanged.
- ADAPT: apply the change, adjusted to this project's code.
- KEEP: keep the downstream version. Record one line saying why.
- N/A: the affected code does not exist in this project.

Rules from past syncs:

- Write down every KEEP. An unrecorded KEEP looks like an oversight to
  the next sync and gets overwritten.
- Verify that a bug reported upstream exists downstream before
  planning its fix. In one recorded sync, 3 of 13 such reports did not
  apply.
- Evaluate an upstream security fix against this project's configuration
  before applying it. A hook that makes the first registered user an
  admin is a regression in a project whose admin account comes from the
  seed.
- When a fix changes a shared helper, search the downstream for its other
  callers and for every reader of the affected stored data. Search beyond
  the files listed in the upstream commit.
- Before adopting a new save-time validator on a live install, query
  existing data for every value it will reject. A stored fragment-only
  link once caused its page to fail validation on every save.

## 3. Verify, then update the marker

- A passing build alone does not verify behavior. Run the build and
  typecheck, then `pnpm --filter @astroload/web test:e2e` against the
  built web app and a local database with the seeded demo content (setup
  in [`conventions.md`](./conventions.md#end-to-end-tests)). The suite
  expects the demo pages and the Contact form and creates and deletes
  documents as an admin, so do not run it against a restored dump. Then
  check by hand each request path that the applied changes touch and the
  suite does not cover.
- On a live project, verify against a restored production dump when the
  applied changes touch schema, validation, access control, or stored
  content. A doc-only or marker-only sync skips this. Do not point
  anything writable at the live URI.
- Record KEEP and ADAPT decisions where this project keeps such notes.
- After everything above, set `upstream_commit` to the target commit's
  full SHA and `upstream_release` to the matching release tag in
  `.astroload.yml`. After a sync to an untagged commit, update
  `upstream_commit` alone and leave `upstream_release` at the last release
  the project fully includes.

## Preparing for Payload 4

Payload 4 is in beta (`4.0.0-beta.3` when this was written). Its
[migration guide](https://github.com/payloadcms/payload/blob/beta/docs/migration-guide/v4.mdx)
on the `beta` branch lists these changes that touch the starter:

- Payload 4 needs Node 24.22.1 or newer and TypeScript 6.0.3 or newer. The
  starter pins Node 22.23.4 and TypeScript 5.9.3.
- `overrideAccess` defaults to `false` on Local API operations. Seed scripts,
  hooks and other trusted server code that relied on the old default pass
  `overrideAccess: true`.
- A query without `depth` populates one relationship level instead of two.
  Check each query that reads a relationship without an explicit `depth`, or
  set `defaultDepth: 2` in the config.
- Collections and globals get versions by default. Auth collections do not.
  Set `versions: false` where a collection or global stays without versions,
  or run `npx @payloadcms/codemod --transform migrate-versions-default`.
- Without `readVersions`, version access follows the `read` access, so a
  public `read` exposes drafts and old versions. The content collections set
  `readVersions: isPanelUser` in `cms/src/access/contentAccess.ts`. Media, the
  form builder `forms` collection and the globals have a public `read`. Give
  them `readVersions: isPanelUser` or `versions: false`, and do the same for
  each project collection with a public `read`.
- All collections and globals, including the form builder and redirects
  collections, gain `createdBy` and `updatedBy` fields. Regenerate the types
  with `pnpm --filter @astroload/cms generate:types`.
- The `sizes` group on upload documents becomes `variants`, and `imageSizes`
  moves to `sharpTransformer`. Find the places that read them with
  `rg -n '\.sizes\b|imageSizes' cms/src web/src`. Stored documents keep
  `sizes` until a data migration runs:
  `pnpm --filter @astroload/cms payload migrate:create --file @payloadcms/db-mongodb/sizes-to-variants`,
  then `pnpm --filter @astroload/cms payload migrate`.
- Payload ships no SCSS toolchain. Custom admin stylesheets are plain `.css`
  files. The starter's is `cms/src/app/(payload)/custom.css`.
