# Deployment

Both apps are plain Node servers. The web app builds for Astro's standalone
Node adapter, so it runs on container platforms and Node hosts: a PaaS
container runtime, a VPS with compose, a bare Node process. A platform's
serverless-native runtime (Cloudflare Workers, Netlify Functions) would need
an adapter swap and is not covered here. The simplest deploy is the one in
the [README](../README.md#deployment): `build` and `start` per app on a
plain Node host. This page covers the container path. Railway is the reference
platform: the [Railway](#railway) section lists each service's settings, and
the page marks every variable that applies only on Railway. Other container
hosts work when they meet the constraints below.

Before committing to a platform, check the constraints the template relies
on:

- Build-log visibility. Content problems surface during `astro build`, so
  the platform must show the build output.
- Build-arg support. The web image takes its keys as declared build args
  (see below).
- A configurable healthcheck path. The CMS healthcheck belongs on
  `/api/health`.
- Public bucket reads, only when you opt into direct media serving (see
  below). The proxied default works on any bucket.

## Images

`cms/Dockerfile` and `web/Dockerfile` build from the repo root, so the pnpm
workspace is in context:

```bash
docker build -f cms/Dockerfile -t astroload-cms .
```

The CMS image runs Next's standalone output. The Dockerfile sets
`NEXT_OUTPUT=standalone`, which switches it on in `next.config.ts`, and
`SKIP_ENV_VALIDATION=1`, so the required env vars are checked at container
start rather than at build. At runtime the container needs `DATABASE_URI`,
`PAYLOAD_SECRET`, `SERVER_URL`, `WEBSITE_URL`, and `PREVIEW_SECRET`, plus any
optional integrations. When S3 is not configured, uploads write to `MEDIA_DIR`
(`/app/media` in the image). Mount a volume at that path, or the files are
lost when the container is replaced.

The web image is different: the site is built into the
image. `astro build` prerenders the static routes from CMS content and
bakes the public env values into the output, so the build needs a reachable
CMS and production values:

```bash
docker build -f web/Dockerfile -t astroload-web \
  --build-arg CMS_URL=https://cms.example.com \
  --build-arg WEBSITE_URL=https://www.example.com \
  --build-arg PAYLOAD_READ_KEY=<read api key> .
```

The read key comes in as a declared build arg rather than a BuildKit
secret, because PaaS builders that lack secret support fill declared ARGs
from the service's variables. `PAYLOAD_READ_KEY` needs its real value
because the build uses it to fetch the content for prerendering.
`PAYLOAD_PREVIEW_KEY` and `PREVIEW_SECRET` only have to be set, because
`astro:env` checks that they exist when the prerender imports the preview
SDK. The Dockerfile defaults both to a placeholder, and the real values
come from the runtime environment. If a build writes provenance
attestations, the build-arg values are recorded in them. The image itself
contains none of these values except `CMS_URL`, because its runtime stage
copies only the build output and sets `CMS_URL` as env.

`UMAMI_WEBSITE_ID` and `CONTENT_BUILD_ID` are optional build args. At
runtime the container needs `CMS_URL` for the `frame-ancestors` header
(see [`security.md`](./security.md#cross-origin-posture)). It also needs
`PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY`, and `PREVIEW_SECRET` for the
preview route, the per-locale sitemaps, the error pages, and any SSR
opt-in route, plus `UMAMI_HOST_URL` when the analytics proxy should target
a self-hosted Umami instead of Umami Cloud.

A change that affects prerendered output means a new web image. Point the deploy webhook
(`DEPLOY_HOOK_URL`) at whatever rebuilds and redeploys it. On Railway, set
`DEPLOY_RAILWAY_TOKEN` and `DEPLOY_RAILWAY_SERVICE_ID` in the CMS instead (see
[`maintenance.md`](./maintenance.md#same-commit-redeploys-and-the-content-build-id)).

## Compose scaffold

[`deploy/docker-compose.production.yml`](../../deploy/docker-compose.production.yml)
defines the three services, with volumes for the database and uploads.
Copy it and adapt it. Its header comment covers the first boot, which has
to start the CMS before the web image can build. On first boot, create the
accounts before the CMS hostname is publicly reachable: registration on an
empty instance is open and the first account becomes an admin
([`security.md`](./security.md#authentication-model)). Open `/admin` on the
not-yet-public origin, register the admin account, and create two API keys
(types `read-only` and `preview`). The web build needs the read-only key's
value. A workspace checkout can run the auth seed
(`pnpm --filter @astroload/cms seed:auth`) instead, but the CMS container
image does not include it. The web build's
`PAYLOAD_READ_KEY` comes in through a build arg that Compose reads from
the shell environment or a `.env` beside the compose file. `web.env` only
reaches the running container.

The web service carries commented `UMAMI_WEBSITE_ID` and `CONTENT_BUILD_ID`
build args. Uncomment `CONTENT_BUILD_ID` when the publish hook rebuilds
through this compose file: without a fresh value per publish, `docker compose
build web` on an unchanged commit replays the cached prerender layer and the
new content does not reach the image (see
[`maintenance.md`](./maintenance.md#same-commit-redeploys-and-the-content-build-id)).

## MongoDB host kernel and image upgrades

MongoDB 8 stops at startup on Linux kernels 6.19 to 7.0.13. It checks the
kernel version at startup because its bundled memory allocator (TCMalloc)
can crash on these kernels. Kernels 7.0.14 and later run MongoDB 8. Every
MongoDB 8 package has the check, Docker images included, so no other 8.x tag
avoids it
([MongoDB 8.0 release notes](https://www.mongodb.com/docs/manual/release-notes/8.0/)).

The `mongo` container uses the kernel of the Docker host: the production
server, or the Linux VM of Docker Desktop, Colima or WSL on a workstation.
Before you upgrade that kernel, or Docker Desktop, Colima or WSL, check which
kernel version the upgrade installs. Before you move a project from an older
MongoDB to `mongo:8`, check the running kernel:

```bash
uname -r                          # on a Linux host
docker run --rm alpine uname -r   # Docker VM on macOS or Windows
```

On a PaaS, run `uname -r` in a service shell, if the platform offers one. A
managed database service such as Atlas runs MongoDB on its own hosts, so
this check does not apply.

The compose files use the `mongo:8` tag. After a pull, the next container
start can run a newer 8.x release series on the existing volume. The data
keeps its feature compatibility version (FCV) until an admin raises it with
`setFeatureCompatibilityVersion`. Before you pull, read the FCV in the
directory of the compose file in use:

```bash
docker compose exec mongo mongosh --quiet --eval 'db.adminCommand({getParameter: 1, featureCompatibilityVersion: 1})'
```

After the pull, read the series of the new image. This does not touch the
volume:

```bash
docker run --rm mongo:8 mongod --version
```

If that series is newer than the FCV, back up with `mongodump` (see
[`maintenance.md`](./maintenance.md#moving-data-between-mongo-databases)).
Then follow the upgrade steps in the release notes for that series
([release notes index](https://www.mongodb.com/docs/manual/release-notes/))
before the container restarts on the new image.

## Direct media serving (optional)

With S3 configured, media is served through Payload's file route
(`/api/media/file/*`): the CMS streams the file from the bucket, the media
collection's read access applies, and stored URLs stay relative. This works
on any bucket, including providers without public-read ACLs or a public
bucket domain.

To serve files straight from the bucket instead, extend the `s3Storage` call
in `cms/src/payload.config.ts`:

```ts
collections: { media: { disablePayloadAccessControl: true } },
acl: 'public-read',
```

This requires a provider that supports public bucket reads, and
`S3_ENDPOINT` must be set: the plugin builds each direct file URL as
`<endpoint>/<bucket>/<file>`. It also changes what is stored: direct mode
persists absolute bucket URLs in `media.url` and the per-size `sizes.*.url`
fields, and a later switch back to proxied mode does not rewrite them, so
existing documents keep pointing at the bucket. Migrating back needs a
backfill that sets those fields to their `/api/media/file/<filename>` form.
The objects in the bucket stay as they are.

## In front of the containers

The web app compresses its own responses: `web/server.mjs` wraps the
standalone handler with the `compression` package, which negotiates brotli
or gzip per request and sets `Vary: Accept-Encoding`. The server still
speaks plain HTTP only. TLS termination stays in a reverse proxy or CDN,
which passes the already-encoded responses through. The go-live section in
[`maintenance.md`](./maintenance.md) has the verification steps.

Behind a CDN that compresses at the edge, the compression in `web/server.mjs`
is redundant but harmless. Keep `web/server.mjs` as the entry point: it also
runs the alias redirect and sends the `frame-ancestors` header, and
`dist/server/entry.mjs` does neither.

The reverse proxy or CDN also needs these settings:

- If the host exposes a generated hostname next to the custom domain (Railway's
  `*.up.railway.app`, Fly's `*.fly.dev`), redirect it to the canonical origin,
  at the proxy or in `web/server.mjs`. Search engines index the alias as a
  duplicate site. Astro middleware does not run for prerendered pages, so it
  cannot do the redirect. In `web/server.mjs`, set `ALIAS_REDIRECT_HOSTS` to the
  generated host names and `ALIAS_REDIRECT_ORIGIN` to the canonical origin. The
  server matches the `x-forwarded-host` header only, because a proxy can rewrite
  `Host` to the internal name. The proxy must send `x-forwarded-host`. A request
  without it gets no redirect. The server answers 302, or 301 when
  `ALIAS_REDIRECT_PERMANENT` is `1` or `true`. Set `ALIAS_REDIRECT_PERMANENT`
  only after the canonical host serves the site, because browsers cache a 301.
- The Node adapter builds `Astro.url` from the `Host` or `x-forwarded-host`
  header only when that host is in `security.allowedDomains`. For any other
  host, the host of `Astro.url` is `localhost:<port>`.
  `web/astro.config.mjs` sets the list to the host name of `WEBSITE_URL` at
  build time. A site that serves pages on more host names adds a
  `{ hostname: '<host>' }` entry for each. When the list is not empty, Astro
  takes `x-forwarded-proto` (`http` or `https`) into `Astro.url` on every
  request. For a listed host, it also takes the first `x-forwarded-for` value
  as `Astro.clientAddress`. The proxy must overwrite both headers.
- When Umami is enabled, the proxy must pass the visitor's IP as `x-real-ip`
  (or `web/src/pages/api/send.ts` must be adjusted to the header it does set).
  With the wrong header, analytics still answers 200, but every visitor reports
  the proxy's IP and country. The proxy should also overwrite an
  `x-real-ip` the client sent itself: a caller who reaches the app directly
  can otherwise attribute forged events to an arbitrary IP. That only skews
  analytics (the same forgery works against Umami directly, since the website
  id is public in the tracker tag), but there is no reason to leave it open.

## Railway

Enter the settings below in each service's dashboard, or in a Railway
Infrastructure as Code file, `.railway/railway.ts`
([docs](https://docs.railway.com/infrastructure-as-code)). The file imports
the `railway` npm package. Railway does not read the file during a deploy, so
run `railway config apply` after each change to it. The starter has no
`railway.json` or `railway.toml`, because new services cannot use them and
Railway stops reading existing files on 2026-12-01
([docs](https://docs.railway.com/reference/config-as-code)). Until then, a
file's values override the dashboard settings, and Railway blocks an
Infrastructure as Code plan for a service that a file manages. If the project
has `railway.json` or `railway.toml`, or a service whose settings name a
config file path, copy the file's values to the dashboard or to
`.railway/railway.ts`, delete the file and clear the config file path in the
service settings. If you moved the values to `.railway/railway.ts`, run
`railway config plan` and `railway config apply` only after that.

| Setting | CMS service | Web service |
|---|---|---|
| Builder | Dockerfile | Dockerfile |
| `RAILWAY_DOCKERFILE_PATH` variable | `cms/Dockerfile` | `web/Dockerfile` |
| Watch paths | `cms/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc` | the CMS paths and `web/**` |
| Healthcheck path | `/api/health` | `/en`, the home page of the default locale |
| Restart policy | On failure | On failure |

The web service watches `cms/**` too, because its build imports the CMS
types and site config. Railway counts only a `2xx` answer as healthy and runs
the healthcheck only at the start of a deployment
([docs](https://docs.railway.com/deployments/healthchecks)). The root `/`
answers 302, so the web healthcheck uses the locale home. A site that serves
its home page at `/` uses `/`.

Turn on "Wait for CI" for both services. Railway then holds a new deployment
in `WAITING` until every GitHub Actions workflow run on the commit has
finished, and skips the deployment when a workflow fails
([docs](https://docs.railway.com/guides/github-autodeploys)). The `CI`
workflow runs on every push to `main`, so Railway deploys only commits that
pass it. Add a branch protection rule for `main`. Require the `check` and
`e2e` status checks of the `CI` workflow and turn on "Do not allow bypassing
the above settings". Commits without passing checks then do not reach `main`.
GitHub Actions holds no deploy job and no Railway token.

MongoDB on Railway:

- The Railway MongoDB template runs one standalone node and defines the
  variables `MONGOUSER`, `MONGOPASSWORD`, `MONGOHOST` and `MONGOPORT`, which
  other services can reference
  ([docs](https://docs.railway.com/databases/mongodb)). Its `MONGO_URL` names
  no database, so a CMS whose `DATABASE_URI` is `${{MongoDB.MONGO_URL}}`
  writes to the `test` database. Set the CMS `DATABASE_URI` to
  `mongodb://${{MongoDB.MONGOUSER}}:${{MongoDB.MONGOPASSWORD}}@${{MongoDB.MONGOHOST}}:${{MongoDB.MONGOPORT}}/astroload?authSource=admin`.
- `mongodump --oplog` needs a replica set
  ([docs](https://www.mongodb.com/docs/database-tools/mongodump/)). Without
  `--oplog` a dump is not a point-in-time copy, so run `mongodump` while
  nobody edits content.
- Railway volume backups keep daily backups for 6 days, weekly backups for 27
  days and monthly backups for 89 days. A backup restores only into the same
  project and environment, and wiping a volume deletes its backups
  ([docs](https://docs.railway.com/volumes/backups)). Keep dumps outside the
  project for longer retention.
- Railway storage buckets support no lifecycle rules, object versioning or
  object locks ([docs](https://docs.railway.com/storage-buckets)). A dump in a
  bucket stays until a job deletes it, and a delete or an overwrite is final.
