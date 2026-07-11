# Content workflow

How to change content in this starter, and where a mutation script belongs when
you need one.

Most changes need no script. When one is warranted, the split is simple: a
script that has to be reproducible, such as a migration or a backfill, is
committed and reviewed like any other code. A one-off edit is written in the
gitignored scratch directory instead, so it never enters git history.

## Pick the lightest path that does the change

1. **Admin UI** is the default for a human. Log in at `/admin`, edit, save or
   publish. Access control, validation, versions, and the deploy hook all run.
   Nothing to clean up.
2. **MCP** is the recommended path for an agent. With the Payload MCP plugin
   enabled, an assistant edits content through typed tools instead of writing a
   script. See [Enabling MCP](#enabling-mcp). Off by default in this starter.
3. **REST API** is the path for a program or a CI step. Authenticate, then call
   the documented endpoints. See [REST](#rest).
4. **A Local API script** is for a change the paths above cannot express, or one
   that has to be reproducible. Whether it is committed or thrown away depends on
   which. See [Scripts: durable versus throwaway](#scripts-durable-versus-throwaway).

Reach for the first one that does the job. A single field edit is an admin click,
not a script.

## Enabling MCP

MCP is the smoothest agent path once it is wired, because the assistant mutates
content through typed tools with access control still enforced, and writes
nothing to the tree. It is opt-in here so the starter ships no extra server
surface or key collection by default. A project that does agent-driven editing
should turn it on.

Add the Payload MCP plugin (`@payloadcms/plugin-mcp`) to
`cms/src/payload.config.ts`, following the plugin's current setup and
authentication docs. Then point an MCP client at the running CMS. A project-level
config for an HTTP MCP server has this shape (confirm the endpoint path and auth
header against the plugin docs, they are what the plugin defines, not this
starter):

```jsonc
// .mcp.json
{
  "mcpServers": {
    "payload": {
      "type": "http",
      "url": "http://localhost:3000/api/plugin/mcp",
      "headers": { "Authorization": "Bearer ${PAYLOAD_MCP_KEY}" }
    }
  }
}
```

```bash
# cms/.env, only once the plugin is enabled
PAYLOAD_MCP_KEY=your_mcp_key_here
```

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
`src/upsertByKey.ts` is the primitive for that: it finds a document by a stable
key (a slug, a title), updates it when it exists, and creates it only when
missing, so a bulk content script converges on the same documents instead of
duplicating them run over run.
`src/scripts/seed.ts` is the worked example: re-running it is a no-op unless
`--force` or `SEED_FORCE=1` is passed. The auth bootstrap (admin user and API
keys) lives separately in `src/seedAuth.ts` with its own script entry
(`pnpm --filter @astroload/cms seed:auth` from the repo root), so a real
project can delete the demo seed without losing the path that provisions a
fresh database.

Throwaway scripts are not committed. A one-time local edit with no lasting value
goes in `cms/src/scripts/scratch/`, which is gitignored except for its README, so
it never enters git history.

Both kinds run the same way, through `payload run`:

```bash
pnpm --filter @astroload/cms payload run src/scripts/scratch/backfill.ts
```

`cms/src/scripts/scratch/README.md` has the script skeleton.

## Local versus deployed

Every path above targets whatever the CMS env points at. `payload run` and the
Local API read `cms/.env`, so a scratch script hits whatever `DATABASE_URI`
resolves to. Keep that on the local database.

The scratch skeleton ships a preflight that throws unless `DATABASE_URI` points
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
