# Content workflow

How to change content in this starter, and where a mutation script belongs when
you need one.

Most changes need no script. When one is warranted, a script that has to be
reproducible, such as a migration or a backfill, is committed and reviewed
like any other code. A one-off edit is written in the gitignored scratch
directory instead, so it does not enter git history.

## Pick the lightest path that does the change

1. The admin UI is the default for a human. Log in at `/admin`, edit, save or
   publish. Access control, validation, versions, and the deploy hook all run.
   Nothing to clean up.
2. MCP is the recommended path for an agent. With the Payload MCP plugin
   enabled, an assistant edits content through typed tools instead of writing a
   script. See [Enabling MCP](#enabling-mcp). Off by default in this starter.
3. The REST API is the path for a program or a CI step. Authenticate, then call
   the documented endpoints. See [REST](#rest).
4. A Local API script is for a change the paths above cannot express, or one
   that has to be reproducible. Whether it is committed or thrown away depends on
   which. See [Scripts: durable versus throwaway](#scripts-durable-versus-throwaway).

Use the first path that does the job. A single field edit belongs in
the admin UI, not a script.

## Enabling MCP

With MCP enabled, an assistant mutates content through typed tools, access
control still enforced, and writes nothing to the tree. It is opt-in so the
starter adds no extra server surface or key collection by default. A project
that does agent-driven editing should turn it on.

Add the Payload MCP plugin (`@payloadcms/plugin-mcp`) to
`cms/src/payload.config.ts` and opt each collection and global you want
exposed into the plugin config. The plugin serves MCP at `/api/mcp` and
authenticates with an API key created in the admin panel under MCP, sent
as a bearer token. Capabilities are toggled per key, so a key grants only
what you enable on it. Payload's access rules and hooks still apply. A
project-level client config:

```jsonc
// .mcp.json
{
  "mcpServers": {
    "payload": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer ${PAYLOAD_MCP_KEY}" }
    }
  }
}
```

`PAYLOAD_MCP_KEY` holds the admin-created key in the MCP client's
environment.

Point the client at the local CMS while developing. Read [Local versus
deployed](#local-versus-deployed) before letting any agent reach a deployed
instance.

## REST

The web app already reads content over REST with a scoped API key, sent as
`Authorization: api-keys API-Key <key>` (see `web/src/cms/sdk.ts`). Those seeded
keys are read-only and preview, so they cannot mutate.

A write needs a user session. Content collections (Pages, Posts, Authors) gate
create, update, and delete on `isAdminOrEditor`, so log in as an `admin` or
`editor` user and use the returned token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin1234"}' | jq -r .token)

curl -X PATCH http://localhost:3000/api/posts/<id> \
  -H "Authorization: JWT $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"New title"}'
```

This runs through the same access control and hooks as the admin UI.

## Scripts: durable versus throwaway

Decide which kind you are writing before you write it. The test is whether the
change has to run again, in another environment, or be reviewable later.

Durable scripts are committed. A migration, a backfill, or a data correction that
has to be reproducible lives in `cms/src/scripts/` alongside the seed, is reviewed
like any other code, and is written to be idempotent so a second run is safe.
`cms/src/upsertByKey.ts` is the primitive for that: it finds a document by a
stable key (a slug, or another value with at most one match), updates it when
it exists, creates it when missing, and throws when the key matches more than
one document. A bulk content script built on it converges on the same
documents instead of duplicating them run over run. Its lookup includes
drafts, so a re-run also overwrites an editor's unpublished draft with the
script's values. A script that may run again once editors manage the
content must either skip documents that already exist or write only empty
fields. The demo seed avoids the problem by refusing to run once users
exist.
`cms/src/scripts/seed.ts` is the worked example: re-running it skips once
users exist, and `--force` or `SEED_FORCE=1` clears the seeded collections,
users and API keys included, and recreates the demo content. The auth
bootstrap (admin user and API
keys) lives separately in `cms/src/seedAuth.ts` with its own script entry
(`pnpm --filter @astroload/cms seed:auth` from the repo root), so a real
project can delete the demo seed without losing the path that provisions a
fresh database.

Throwaway scripts are not committed. A one-time local edit with no lasting value
goes in `cms/src/scripts/scratch/`, which is gitignored except for its README, so
it does not enter git history.

Both kinds run the same way, through `payload run`:

```bash
pnpm --filter @astroload/cms payload run src/scripts/scratch/backfill.ts
```

Await the script's work at the top level, the way the committed scripts
do. `payload run` exits when the module finishes evaluating and does not
wait for floating promises, so a script whose body is an unawaited
async call exits 0 having done nothing.

`cms/src/scripts/scratch/README.md` has the script skeleton.

## Local versus deployed

Every path above targets whatever the CMS env points at. `payload run` and the
Local API read `cms/.env`, so a scratch script hits whatever `DATABASE_URI`
resolves to. Keep that on the local database.

The scratch skeleton includes a preflight that throws unless `DATABASE_URI` points
at `127.0.0.1` or `localhost`, so a misconfigured env stops the script instead of
mutating a remote database. Setting `ALLOW_DEPLOYED_SCRATCH=1` is the explicit
opt-out, for the rare case you do mean to reach a remote instance.

A script runs the same hooks the admin UI runs, but not the same access control:
Payload's Local API defaults to `overrideAccess: true`, so reads and writes skip
the access rules unless the call passes `overrideAccess: false`. That makes a
script the easiest way to run a destructive bulk operation against the wrong
target. To change deployed content, prefer the admin UI or an
admin-authenticated REST call against the deployed CMS, where you authenticate
against that instance explicitly and its access control still applies.

A seed or upload script that does run from a workstation against a deployed
instance needs `MEDIA_DIR` pointed at a fresh temporary directory, for
example `MEDIA_DIR="$(mktemp -d)"` in front of the `payload run` command.
Payload checks the local `staticDir` for duplicate filenames even when S3
storage is configured. A stale file from an earlier local run makes the new
upload store as `<name>-1`, and code that looks the document up by its
original filename no longer finds it.
