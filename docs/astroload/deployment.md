# Deployment

Both apps are plain Node servers. The simplest deploy is the one in the
[README](../README.md#deployment): `build` and `start` per app on any Node
host. This page covers the container path.

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

The web image is different in one important way: the site is built into the
image. `astro build` prerenders every page from CMS content and bakes the
public env values into the output, so the build needs a reachable CMS and
production values:

```bash
docker build -f web/Dockerfile -t astroload-web \
  --build-arg CMS_URL=https://cms.example.com \
  --build-arg WEBSITE_URL=https://www.example.com \
  --secret id=payload_read_key,env=PAYLOAD_READ_KEY .
```

`UMAMI_WEBSITE_ID` and `CONTENT_BUILD_ID` are further optional build args. At
runtime the container needs `PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY`, and
`PREVIEW_SECRET` for the preview route and any SSR opt-in route, plus
`UMAMI_HOST_URL` when the analytics proxy should target a self-hosted Umami
instead of Umami Cloud.

A content publish means a new web image. Point the deploy webhook
(`DEPLOY_HOOK_URL`) at whatever rebuilds and redeploys it.

## Compose scaffold

[`deploy/docker-compose.production.yml`](../../deploy/docker-compose.production.yml)
wires the three services together with volumes for the database and uploads.
Copy it and adapt. Its header comment walks through the first boot, which has
to start the CMS before the web image can build. The web build's
`PAYLOAD_READ_KEY` comes in through a BuildKit secret that Compose reads from
the shell environment or a `.env` beside the compose file. `web.env` only
reaches the running container.

## In front of the containers

The web server sends uncompressed responses over plain HTTP. Terminate TLS and
compression in a reverse proxy or CDN. The host cutover runbook in
[`maintenance.md`](./maintenance.md) has the verification steps.

Two more jobs belong in that proxy layer:

- If the host exposes a generated hostname next to the custom domain (Railway's
  `*.up.railway.app`, Fly's `*.fly.dev`), 301 it to the canonical origin there.
  Astro middleware cannot do it, because middleware does not run for
  prerendered pages, and search engines index the alias as a duplicate site.
- When Umami is enabled, the proxy must pass the visitor's IP as `x-real-ip`
  (or `web/src/pages/api/send.ts` must be adjusted to the header it does set).
  Get this wrong and analytics keeps answering 200 while every visitor reports
  the proxy's IP and country.
