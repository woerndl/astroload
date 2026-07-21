# Deployment

Both apps are plain Node servers. The web app builds for Astro's standalone
Node adapter, so it runs on container platforms and Node hosts: a PaaS
container runtime, a VPS with compose, a bare Node process. A platform's
serverless-native runtime (Cloudflare Workers, Netlify Functions) would need
an adapter swap and is not covered here. The simplest deploy is the one in
the [README](../README.md#deployment): `build` and `start` per app on a
plain Node host. This page covers the container path.

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
(`/app/media` in the image). Mount a volume at that path or the files vanish
with the container.

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
does not contain the values, its runtime stage copies only the build
output.

`UMAMI_WEBSITE_ID` and `CONTENT_BUILD_ID` are further optional build args. At
runtime the container needs `PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY`, and
`PREVIEW_SECRET` for the preview route, the per-locale sitemaps, the error
pages, and any SSR opt-in route, plus
`UMAMI_HOST_URL` when the analytics proxy should target a self-hosted Umami
instead of Umami Cloud.

A change that affects prerendered output means a new web image. Point the deploy webhook
(`DEPLOY_HOOK_URL`) at whatever rebuilds and redeploys it.

## Compose scaffold

[`deploy/docker-compose.production.yml`](../../deploy/docker-compose.production.yml)
defines the three services, with volumes for the database and uploads.
Copy it and adapt. Its header comment covers the first boot, which has
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

Behind a CDN that compresses at the edge the wrapper is redundant but
harmless. A CDN that pre-compresses static assets offline at the highest
brotli level compresses them somewhat better than the wrapper does at
runtime. A deployment that has verified edge compression can
revert the `start` script to `node ./dist/server/entry.mjs` and the
Dockerfile CMD to `web/dist/server/entry.mjs`, using the curl check in
maintenance.md to decide.

More jobs that belong in that proxy layer:

- If the host exposes a generated hostname next to the custom domain (Railway's
  `*.up.railway.app`, Fly's `*.fly.dev`), 301 it to the canonical origin there.
  Search engines index the alias as a duplicate site, and Astro middleware
  cannot do the redirect because middleware does not run for prerendered pages.
- When Umami is enabled, the proxy must pass the visitor's IP as `x-real-ip`
  (or `web/src/pages/api/send.ts` must be adjusted to the header it does set).
  Get this wrong and analytics keeps answering 200 while every visitor reports
  the proxy's IP and country. The proxy should also overwrite an
  `x-real-ip` the client sent itself: a caller who reaches the app directly
  can otherwise attribute forged events to an arbitrary IP. That only skews
  analytics (the same forgery works against Umami directly, since the website
  id is public in the tracker tag), but there is no reason to leave it open.
