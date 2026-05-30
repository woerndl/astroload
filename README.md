<p align="center">
  <img src=".github/banner.webp" alt="astroload" />
</p>

# 🧑‍🚀 Astroload: Astro 6 + Payload Starter Template

[![Astro](https://img.shields.io/badge/Astro-6-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Payload](https://img.shields.io/badge/Payload-3-000000?logo=payloadcms&logoColor=white)](https://payloadcms.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Postgres](https://img.shields.io/badge/Postgres-17-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

Astroload is an Astro 6 + Payload CMS starter template and boilerplate, built as a pnpm workspace on Postgres. It includes live preview, multi-locale routing, SEO output, S3 storage, spam-protected forms, build-time redirects, deploy webhooks, and a typed CMS data layer with LRU caching.

> [!NOTE]
> This template is in active development. Production deployment is untested. Expect the API, content model, and project structure to change between releases. Pin a tag or commit if you build on top of it.

## Features

**Content and CMS**

- Page builder with rich text, image, form, and dynamic posts/authors list blocks
- Drafts and autosave on Pages, Posts, and Authors
- Role-based access (`admin`, `editor`) plus separate API keys for read-only and preview reads. The Astro side uses these scoped keys, so no admin-capable Payload token ships in `web/.env`
- Editor-managed Header, Footer, Labels, and SiteSettings globals
- Seed script for an admin user, API keys, and demo content, safe to re-run

**Frontend rendering**

- Astro 6 with prerendered pages in production and an SSR fallback in dev so CMS edits show up without restarts
- Tailwind v4 via `@tailwindcss/vite`, no PostCSS layer
- View transitions via `<ClientRouter />`
- Lexical rich text with custom block and upload renderers
- Typed data layer backed by an LRU cache, bypassed in dev and inside the preview iframe

**Live preview**

- Autosave-driven preview on every editable collection
- Mobile, tablet, and desktop breakpoints preconfigured in the admin
- Editor toolbar overlay on the standalone preview tab, hidden inside the Payload iframe
- Preview route guarded by a shared secret with `crypto.timingSafeEqual`, served with `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer`

**SEO and i18n**

- Two locales (`en`, `de`) with per-locale URL segments and `hreflang` plus `x-default` on every page
- Editable SEO metadata (title, description, image) on every content type, with fallbacks
- JSON-LD output: `WebSite` and `Organization` on home, `Article` on posts, `Person` on authors
- Sitemap index plus per-locale sitemaps with `lastmod` and alternate-locale links
- `robots.txt` gated by a SiteSettings toggle so staging stays out of search
- Language switcher in the header

**Forms and spam protection**

- Form builder with text, email, number, textarea, select, checkbox, and message fields
- Client-side submission to the CMS endpoint (JavaScript required)
- Hidden honeypot field plus a submit-time trap, both stripped server-side

**Operations**

- Build-time redirects fetched from a `Redirects` collection, no runtime hop
- Deploy webhook (`DEPLOY_HOOK_URL`) for Railway, Vercel, Coolify, or any plain endpoint, throttled per doc
- Optional integrations, each turning on when its env vars are set: S3 storage (falls back to the local filesystem under `cms/media/`) and Resend email (falls back to console logging)
- Locale-aware custom 404 and 500 pages

## Stack

- Astro 6 with the Node adapter (`@astrojs/node`)
- Payload 3 on Next 16 and React 19
- Postgres 17 via `@payloadcms/db-postgres`
- Tailwind CSS v4 via `@tailwindcss/vite`
- TypeScript 5.7
- pnpm 10 workspaces
- Node `>=22.12` (pinned in `.nvmrc`)

## Quickstart

Prerequisites: Node `>=22.12` (see `.nvmrc`), pnpm `>=9`, Docker. The package scripts assume a POSIX shell, so on Windows run them under WSL or Git Bash.

```bash
# 1. Get the code
git clone https://github.com/woerndl/astroload.git
cd astroload

# 2. Install dependencies
pnpm install

# 3. Start local Postgres
docker compose up -d

# 4. Set up env files
cp cms/.env.example cms/.env
cp web/.env.example web/.env
# In both files, fill in:
#   PAYLOAD_SECRET   (openssl rand -base64 32)
#   PREVIEW_SECRET   (openssl rand -hex 32)

# 5. Seed the database (creates admin user, API keys, demo content)
pnpm --filter @astroload/cms seed
# The seed prints PAYLOAD_READ_KEY and PAYLOAD_PREVIEW_KEY.
# Paste both into web/.env.
```

The seed creates an admin user `admin@example.com` / `admin1234`. Change the
password (or the credentials in `cms/src/seed.ts`) before deploying.

Then run the two dev servers in **separate terminals**:

```bash
# Terminal 1: Payload admin at http://localhost:3000/admin
pnpm --filter @astroload/cms dev
```

```bash
# Terminal 2: Astro site at http://localhost:4321
pnpm --filter @astroload/web dev
```

Re-seeding from a populated database needs `--force` or `SEED_FORCE=1`.

## Environment

Variables are declared in `cms/.env.example` and `web/.env.example`, which are the source of truth.

**CMS (`cms/.env`)**

- `DATABASE_URI` Postgres connection string. The docker-compose service uses `postgres://astroload:astroload@127.0.0.1:5432/astroload`.
- `PAYLOAD_SECRET` admin session secret.
- `SERVER_URL` origin the admin is served from. Must match the browser origin for csrf.
- `WEBSITE_URL` Astro frontend origin used by `generatePageURL`.
- `PREVIEW_SECRET` shared secret for the `/preview` route. Must match `web/.env`.
- `DEPLOY_HOOK_URL` optional. Any plain webhook endpoint.
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_FROM_NAME` optional.
- `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` optional.

**Web (`web/.env`)**

- `PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY` minted by the seed.
- `PREVIEW_SECRET` matches the CMS value.
- `CMS_URL`, `WEBSITE_URL` origins.
- `PLAUSIBLE_DOMAIN` optional.
- `CMS_URL`, `WEBSITE_URL`, and `PLAUSIBLE_DOMAIN` are public, build-time-baked values. Build the web app with production values. Injecting them only at runtime has no effect. See [Deployment](#deployment).

## Architecture

```mermaid
flowchart LR
    Editor -->|HTTPS| CMS["cms<br/>Payload + Next.js admin"]
    CMS <-->|SQL| Postgres[(Postgres)]
    CMS -->|REST / GraphQL| Web["web<br/>Astro + Node adapter"]
    Visitor -->|HTTPS| Web
```

Two Node processes, one Postgres database. `cms/` owns the admin, the API, and the schema. `web/` reads from the CMS over HTTP at build time (for prerendered pages and redirects) and at request time (for `/preview` and any opted-in SSR route). See [`docs/architecture.md`](./docs/architecture.md) for the longer version.

```
.
├── cms/                  Payload application (admin, REST and GraphQL)
├── web/                  Astro frontend (public site and /preview)
├── docker-compose.yml    Local Postgres
└── pnpm-workspace.yaml
```

## Deployment

Both apps are plain Node servers. No serverless adapter or provider-specific build step, so any Node host works.

**CMS**

- `pnpm --filter @astroload/cms build` then `pnpm --filter @astroload/cms start`.
- Needs `DATABASE_URI`, `PAYLOAD_SECRET`, `SERVER_URL`, `WEBSITE_URL`, `PREVIEW_SECRET` at runtime. Boot fails fast with a consolidated error if any are missing.
- S3 and Resend turn on when their env vars are set.

**Web**

- `pnpm --filter @astroload/web build` then `pnpm --filter @astroload/web start`. The `start` script binds `0.0.0.0:4321` by default. Container hosts (Railway, Coolify, Fly) inject `HOST` and `PORT` to override that.
- Build env is deploy env. `CMS_URL`, `WEBSITE_URL`, and `PLAUSIBLE_DOMAIN` are `astro:env/client` public values, inlined into the output at `astro build`. The web app must be built with the production values. Injecting them only at `start` has no effect.
- The Astro standalone server does not auto-load `.env`, unlike the CMS's `next start`. The host injects the runtime server vars (`PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY`, `PREVIEW_SECRET`). For local production testing, export them or run `node --env-file=.env ./dist/server/entry.mjs`.
- Pages and sitemap routes are prerendered. The `/preview` route is SSR. A client-side script POSTs form submissions as JSON to Payload's `/api/form-submissions` endpoint, so no Web-side submission route is needed. Submission requires JavaScript.
- `astro build` reads redirects from the `Redirects` collection through the CMS REST API. The CMS must be reachable during build.

**Deploy webhook**

- Setting `DEPLOY_HOOK_URL` in the CMS fires a POST whenever a draft is published, a published doc is deleted, or any global changes. Works with Railway, Vercel, Coolify, or any plain webhook endpoint as-is. Requests are throttled per doc and globals, with a trailing request at window close if more events arrive during the window. See `cms/.env.example` for URL shapes.

## Contributing

Issues and pull requests are welcome. Run `pnpm lint` and `pnpm check` before opening a PR.

## Acknowledgements

- [`jhb-software/payload-astro-website-template`](https://github.com/jhb-software/payload-astro-website-template) for the starting reference.
- [`@jhb.software/payload-pages-plugin`](https://github.com/jhb-software/payload-plugins) for the URL tree.
- [`@jhb.software/astro-payload-richtext-lexical`](https://github.com/jhb-software/payload-plugins) for Lexical rendering.
- [`astro-seo-schema`](https://github.com/codingcatdev/astro-seo-schema) for JSON-LD output.

## License

[MIT](LICENSE) © Alexander Wörndl
