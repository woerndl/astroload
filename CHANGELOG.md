# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Added

- pnpm-workspace scaffold with `cms/` (Payload 3.84.1, Postgres via `@payloadcms/db-postgres`) and `web/` (Astro 6.3.1).
- `docker-compose.yml` for local Postgres (dev only).
- Turbopack workspace-root fix in `cms/next.config.ts` so Turbopack resolves `next/package.json` from `cms/src/app` under the pnpm-workspace layout.
- ESLint flat-config for `cms/` using `eslint-config-next` subpath exports.
- Users collection with `firstName`, `lastName`, and `roles` (editor and admin, `saveToJWT`). Read and update via `isSelfOrAdmin`, create and delete via `isAdmin`.
- ApiKeys collection with `useAPIKey`, `disableLocalStrategy`, and a `type` discriminator: `read-only` for published reads, `preview` for drafts and published. Admin-only access.
- Access helpers under `cms/src/access/`: `isAdmin`, `isAuthenticated`, `isSelfOrAdmin`, `isReadOnlyKey`, `isPreviewKey`. `field/isAdmin` for field-level access.
- Boot-time check at `cms/src/env.ts` that requires `PAYLOAD_SECRET`, `DATABASE_URI`, `SERVER_URL`, and `WEBSITE_URL`, throwing with a consolidated error if any are missing.
- CMS content surface. Pages, Posts, Authors, Redirects collections via `@jhb.software/payload-pages-plugin`. Drafts on Pages, Posts, Authors. `Posts` and `Authors` use a shared parent Pages doc per collection. `name` on Authors stays non-localized.
- Globals: `Header`, `Footer`, `Labels`, `SiteSettings`. Public read, admin update. SiteSettings carries default SEO triple, a Plausible domain placeholder, and a `robots.allowIndexing` flag (default off).
- Localization: `de` and `en`, `defaultLocale: 'en'`, `fallback: true`. Localized fields across content collections and globals.
- Media collection with named image sizes (`xs`, `sm`, `md`, `lg`, `og` 1200x630), `mimeTypes: ['image/*']`, `adminThumbnail: 'xs'`, localized `alt` and optional localized `caption`. Writes are admin-only.
- Page-builder blocks under `cms/src/blocks/`: `RichTextBlock`, `ImageBlock`, `FormBlock`, `PostsListBlock`, `AuthorsListBlock`. `Pages.sections` accepts all five. `PostsListBlock` and `AuthorsListBlock` use a virtual relationship whose `afterRead` hook returns all published items in the current locale. The field is hidden in admin. `Posts.publishedAt` and `Authors.name` are indexed for the list-block sort. `Posts.content` is a per-field Lexical editor with `BlocksFeature([ImageBlock])` for inline images.
- `seoPlugin` adds `meta` (title, description, image) to Pages and Posts. `generateTitle` falls back to `doc.title`, `generateURL` resolves against `WEBSITE_URL`.
- `formBuilderPlugin` registers `forms` and `form-submissions` collections with default field set.
- Conditional `s3Storage` env-gated on `S3_BUCKET` plus credentials. `disablePayloadAccessControl: true` and `acl: 'public-read'` on media so file URLs serve directly from the bucket.
- Conditional `resendAdapter` env-gated on `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`. Without those, email is logged to console.
- Access helper `readPublishedOrDraft` in `cms/src/access/`. Read-only API keys see only published. Users and preview keys see drafts and published. Wired into `contentAccess` for Pages, Posts, Authors. Redirects detached from `contentAccess` and uses `isAuthenticated` for read.
- Top-level `serverURL: env.SERVER_URL` so Payload's csrf check accepts the admin session cookie.
- Optional plugin env vars in `cms/.env.example`: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_FROM_NAME`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Default S3 example targets Hetzner Object Storage (`nbg1`).
- Seed script `pnpm --filter cms seed` (with `--force` or `SEED_FORCE=1`) bootstraps an admin user, read-only and preview API keys, a home page plus About and Contact pages, a Posts parent with one seeded post nested under it, an Authors parent with one seeded author nested under it, a contact form, and all globals from a clean database. The `posts` and `authors` parent slugs stay identical across both locales so URLs read as `/<lang>/posts/<slug>` and `/<lang>/authors/<slug>`. Idempotent without force, safe to re-run with force from a populated database. API key values come from `PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` when set, otherwise generated with `crypto.randomBytes(32)` and logged on creation.
- Seed lexical content uses `buildEditorState` from `@payloadcms/richtext-lexical` for rich-text fields and embedded image blocks, so the JSON shape stays in sync with the lexical schema across upgrades.
- Typed data layer in `web/src/cms/`: `getPageData`, `getGlobalData`, and `getStaticPaths` wrap a `createPayloadSDK` factory with a module-scoped `lru-cache` that is gated off in dev so CMS edits propagate without an Astro restart. Bounded at 1024 entries and 32 MiB total.
- Two batch CMS endpoints feed the data layer. `GET /api/global-data` returns header, footer, and labels in one round-trip with localized page paths populated on link references. `GET /api/static-paths` enumerates published pages, posts, and authors with their localized paths. Both carry `ETag` and `Cache-Control`.
- Astro env schema in `web/astro.config.mjs` declares `PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY`, `CMS_URL`, `WEBSITE_URL`, and optional `PLAUSIBLE_DOMAIN` with localhost defaults for dev.
- `@payloadcms/sdk` 3.84.1 added to `web/package.json`.
- Public rendering. Catch-all `/[lang]/[...path]` route renders pages, posts, and authors. Prerendered in production, SSR fallback in dev so CMS edits show without an Astro restart.
- `GET /api/page-by-path` resolves a full URL path to `{ collection, data }`. The pages-plugin `path` field is virtual, so the endpoint matches against slug results from the three page collections.
- Block renderers (`RichTextBlock`, `ImageBlock`, `FormBlock`) and a Lexical pipeline via `@jhb.software/astro-payload-richtext-lexical` with custom block and upload renderers.
- `Img.astro` picks the right `image.sizes` variant and resolves the URL against `CMS_URL` with `new URL()`, which handles trailing slashes and absolute URLs.
- `Layout.astro` with `<ClientRouter />` view transitions, Tailwind v4 via `@tailwindcss/vite` (no PostCSS), minimal default type scale.
- `Header.astro` and `Footer.astro` render the editor-configured globals. Layout fetches global data once per render via `getGlobalData`. The endpoint populates `path` on links into any of the three page collections (pages, posts, authors). Seed adds a second footer column linking to the Posts and Authors overview pages.
- `@astrojs/node@10.1.0` adapter in `mode: 'standalone'` so per-route `prerender = false` works in dev.
- `index.astro` redirects `/` to `/en` with a 302. A file-based route is required because Astro's `redirects:` config drops the status override when the destination resolves to a dynamic route.
- Static `404.astro` (`prerender = true`).
- `web/.env.example` documents the required and optional env values.
- Live Preview surface. Pages, Posts, and Authors enable `autosave: { interval: 1500 }` and opt into the admin's mobile, tablet, and desktop preview breakpoints (defined once in `cms/src/shared.ts`). `payload-pages-plugin` auto-wires `admin.livePreview.url` via `generatePageURL`, which routes preview to `/preview/<lang>/<path>?previewSecret=...` on the Astro side. Public URLs are unchanged.
- `/preview/[lang]/[...path]` Astro route is server-rendered. It validates the supplied `previewSecret` against `PREVIEW_SECRET` with `crypto.timingSafeEqual` (403 on mismatch, 404 on unknown locale or path), then fetches drafts via a separate `previewPayloadSDK` carrying the preview API key. Responses set `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.
- `Layout.astro` accepts an optional `preview` context (`{ collection, id }`). When set, the body renders a fixed "Editing draft / Open in admin" toolbar (hidden inside the Payload iframe via `sec-fetch-dest`) and a `<LivePreviewListener>` that calls `@payloadcms/live-preview` `ready({ serverURL })` and full-reloads on `isDocumentEvent`. `CollectionLayout` threads the context to `PageLayout`, `PostLayout`, and `AuthorLayout`.
- Deploy webhook at `cms/src/hooks/triggerDeploy.ts`. `triggerDeployAfterChange` posts to `DEPLOY_HOOK_URL` only on the draft-to-published transition. `triggerDeployAfterDelete` fires for deletion of a previously published doc. `triggerDeployGlobalAfterChange` fires on any global change. All three share a 5-minute throttle keyed by `${collection}:${id}` or `global:${slug}` that fires the first event immediately and re-fires once at window close if any further events arrived. No-op when `DEPLOY_HOOK_URL` is unset. The single env var works for any plain webhook POST endpoint, including Railway, Vercel, and Coolify deploy hooks.
- `cms/.env.example` documents `DEPLOY_HOOK_URL` with example URL shapes for Railway, Vercel, and Coolify. Both `.env.example` files document `PREVIEW_SECRET` with an `openssl rand -hex 32` hint.
- `web/src/cms/getPageByPath.ts` now treats a CMS 404 as `null` instead of letting `PayloadSDKError` bubble. Required by the `/preview` route, which exercises the SSR path under arbitrary user-typed URLs.
