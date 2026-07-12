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
  recover that commit from project history and add the marker before
  continuing.

## 1. Run the inventory script

    node scripts/sync-inventory.mjs --upstream ../astroload --to v0.6.0

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

The script reports file and commit state only. Deciding whether a change
applies to this project happens in step 2.

## 2. Classify each commit, then apply

Review each commit with `git -C ../astroload show <sha>`. Changelog
entries are summaries and not a basis for classification. Assign one
verdict per commit:

- PULL: apply the upstream change unchanged.
- ADAPT: apply the change, adjusted to this project's code.
- KEEP: keep the downstream version. Record one line saying why.
- N/A: the affected code does not exist in this project.

Rules from past syncs:

- Write down every KEEP. An unrecorded KEEP looks like an oversight to
  the next sync and gets overwritten.
- Verify that a bug reported upstream actually exists downstream before
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

- Run the build and typecheck, then exercise the request paths the
  applied changes touch: form POST, preview, sitemap, analytics relay.
  A passing build alone does not verify behavior.
- On a live project, verify against a restored production dump. Never
  point anything writable at the live URI.
- Record KEEP and ADAPT decisions where this project keeps such notes.
- After everything above, set `upstream_commit` to the target commit's
  full SHA and `upstream_release` to the matching release tag in
  `.astroload.yml`. After a sync to an untagged commit, update
  `upstream_commit` alone and leave `upstream_release` at the last release
  the project fully includes.
