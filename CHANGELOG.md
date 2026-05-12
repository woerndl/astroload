# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

## [0.1.0] - 2026-05-12

### Workspace and stack

- pnpm-workspace with `cms/` (Payload 3.84.1, Postgres via `@payloadcms/db-postgres`) and `web/` (Astro 6.3.1).
- `docker-compose.yml` for local Postgres (dev only).
- Turbopack workspace-root fix in `cms/next.config.ts` so Turbopack resolves `next/package.json` from `cms/src/app` under the pnpm-workspace layout.
- ESLint flat-config for `cms/` using `eslint-config-next` subpath exports.
- `@astrojs/node@10.1.0` adapter in `mode: 'standalone'` so per-route `prerender = false` works in dev.
- Tailwind v4 via `@tailwindcss/vite`.
- Boot-time check at `cms/src/env.ts` requires `PAYLOAD_SECRET`, `DATABASE_URI`, `SERVER_URL`, and `WEBSITE_URL`, throwing with a consolidated error if any are missing.
- Astro env schema in `web/astro.config.mjs` declares `PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY`, `PREVIEW_SECRET`, `CMS_URL`, `WEBSITE_URL`, and optional `PLAUSIBLE_DOMAIN`, with localhost defaults for dev.
- Optional plugin env vars in `cms/.env.example`: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_FROM_NAME`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Default S3 example targets Hetzner Object Storage (`nbg1`).
- `web/.env.example` documents the required and optional env values. Both `.env.example` files document `PREVIEW_SECRET` with an `openssl rand -hex 32` hint.

### Content model

- Pages, Posts, Authors, and Redirects collections via `@jhb.software/payload-pages-plugin`. Drafts on Pages, Posts, and Authors. `Posts` and `Authors` use a shared parent Pages doc per collection. `Authors.name` is non-localized.
- Globals: `Header`, `Footer`, `Labels`, `SiteSettings`. Public read, admin update. SiteSettings carries the default SEO triple, a Plausible domain placeholder, and a `robots.allowIndexing` flag (default off).
- Localization: `de` and `en`, `defaultLocale: 'en'`, `fallback: true`. Localized fields across content collections and globals.
- Media collection with named image sizes (`xs`, `sm`, `md`, `lg`, `og` 1200x630), `mimeTypes: ['image/*']`, `adminThumbnail: 'xs'`, localized `alt` and optional localized `caption`. Writes are admin-only.
- Page-builder blocks under `cms/src/blocks/`: `RichTextBlock`, `ImageBlock`, `FormBlock`, `PostsListBlock`, `AuthorsListBlock`. `Pages.sections` accepts all five. `PostsListBlock` and `AuthorsListBlock` use a virtual relationship whose `afterRead` hook returns all published items in the current locale. The field is hidden in admin. `Posts.publishedAt` and `Authors.name` are indexed for the list-block sort. `Posts.content` is a per-field Lexical editor with `BlocksFeature([ImageBlock])` for inline images.

### Auth and access

- Users collection with `firstName`, `lastName`, and `roles` (editor and admin, `saveToJWT`). Read and update via `isSelfOrAdmin`, create and delete via `isAdmin`.
- ApiKeys collection with `useAPIKey`, `disableLocalStrategy`, and a `type` discriminator: `read-only` for published reads, `preview` for drafts and published. Admin-only access. Admin label `API Key` / `API Keys`, `useAsTitle: 'name'`, and `defaultColumns: ['name', 'type', 'enableAPIKey']`.
- Access helpers under `cms/src/access/`: `isAdmin`, `isAuthenticated`, `isSelfOrAdmin`, and `readPublishedOrDraft`. A field-level `field/isAdmin` restricts admin-only fields.
- `readPublishedOrDraft` wired into `contentAccess` for Pages, Posts, and Authors. Read-only API keys see only published. Users and preview keys see drafts and published.
- Redirects uses standalone access: authenticated read, admin create, update, and delete. Read-only API keys can fetch the table at build time.
- `serverURL: env.SERVER_URL`, `cors: [env.WEBSITE_URL]`, and `csrf: [env.WEBSITE_URL]` on the top-level Payload config so admin session cookies fail closed against unknown origins and the cross-origin form POST is allowed.

### Admin UI

- `cms/src/shared.ts` exports a `CollectionGroups` constant with bilingual `{ de, en }` labels for the `Media` and `System` groups.
- Sidebar groups: Pages, Posts, and Authors sit in the default Collections group. Media gets its own Media group. ApiKeys, Redirects, and Users land under System. `formBuilderPlugin` is configured with `formOverrides` and `formSubmissionOverrides` so Forms and Form Submissions also appear under System.
- Live preview breakpoints (`mobile`, `tablet`, `desktop`) defined once in `cms/src/shared.ts` and reused on Pages, Posts, and Authors.

### Storage and email

- Conditional `s3Storage` env-gated on `S3_BUCKET` plus credentials. `disablePayloadAccessControl: true` and `acl: 'public-read'` on media so file URLs serve directly from the bucket.
- Conditional `resendAdapter` env-gated on `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`. Without those, email is logged to console.

### Seed

- Seed script `pnpm --filter cms seed` (with `--force` or `SEED_FORCE=1`) bootstraps an admin user, read-only and preview API keys, a home page plus About and Contact pages, a Posts parent with one seeded post nested under it, an Authors parent with one seeded author nested under it, a contact form, and all globals from a clean database. The `posts` and `authors` parent slugs match across both locales so URLs read as `/<lang>/posts/<slug>` and `/<lang>/authors/<slug>`. Idempotent without force, safe to re-run with force from a populated database. API key values come from `PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` when set, otherwise generated with `crypto.randomBytes(32)` and logged on creation.
- `createMedia` writes each image's German alt on create with `locale: 'de'`, then updates the same record with the English alt under `locale: 'en'`, so both locales carry distinct text.
- `clearAll` includes the `redirects` collection so `SEED_FORCE=1` leaves a clean database before re-seeding.
- Seed lexical content uses `buildEditorState` from `@payloadcms/richtext-lexical` for rich-text fields and embedded image blocks, so the JSON shape matches the lexical schema across Payload upgrades.

### Web data layer

- Typed data layer in `web/src/cms/`: `getPageData`, `getGlobalData`, `getPageByPath`, and `getStaticPaths` wrap a `createPayloadSDK` factory.
- `cachedFetch` (`web/src/cms/sdk/cachedFetch.ts`) backs the SDK with a module-scoped `lru-cache` bounded at 1024 entries and 32 MiB total. The cache key includes a SHA-256 hash of the `Authorization` header (truncated to 16 bytes) so rotating an API key invalidates old entries and the raw secret never lands in cache keys or diagnostics. The cache is disabled in dev so CMS edits propagate without an Astro restart.
- Three CMS endpoints registered in `payload.config.ts`. `GET /api/global-data` returns header, footer, labels, and site settings in one round-trip with localized page paths populated on link references. `GET /api/static-paths` enumerates published pages, posts, and authors with their localized paths and `updatedAt`. `GET /api/page-by-path` resolves a full URL path to `{ collection, data }`. The pages-plugin `path` field is virtual, so the endpoint matches against slug results from the three page collections. `/api/global-data` and `/api/static-paths` carry `ETag` and `Cache-Control`.
- `web/src/cms/getPageByPath.ts` returns `null` for CMS 404 responses and lets other `PayloadSDKError` values propagate. Required by the `/preview` route, which exercises the SSR path under arbitrary user-typed URLs.
- `pickLocale` (`web/src/cms/pickLocale.ts`) resolves a locale from the URL path, then from the `Accept-Language` header (q-weighted), then from `DEFAULT_LOCALE`. Aware of the `/preview/<lang>/...` prefix. Used by `index.astro`, `404.astro`, `500.astro`, `robots.txt.ts`, and the preview route.

### Public site

- Catch-all `/[lang]/[...path]` route renders pages, posts, and authors. Prerendered in production, SSR fallback in dev so CMS edits show without an Astro restart.
- Block renderers (`RichTextBlock`, `ImageBlock`, `FormBlock`) and a Lexical pipeline via `@jhb.software/astro-payload-richtext-lexical` with custom block and upload renderers.
- `Img.astro` picks the right `image.sizes` variant and resolves the URL against `CMS_URL` with `new URL()`, which handles trailing slashes and absolute URLs.
- `Layout.astro` with `<ClientRouter />` view transitions and a minimal default type scale.
- `Header.astro` and `Footer.astro` render the editor-configured globals. Layout fetches global data once per render via `getGlobalData`. The endpoint populates `path` on links into any of the three page collections (pages, posts, authors). Seed adds a second footer column linking to the Posts and Authors overview pages.
- `index.astro` redirects `/` to `/${locale}` with a 302, where `locale` comes from `pickLocale`. A file-based route is required because Astro's `redirects:` config drops the status override when the destination resolves to a dynamic route.
- `404.astro` and `500.astro` are server-rendered (`prerender = false`), pick a locale with `pickLocale`, and render through `Layout.astro` with editor-controlled copy from `Labels.notFound` and `Labels.serverError`. Both link back to `/${locale}`.

### Forms and spam protection

- `formBuilderPlugin` registers `forms` and `form-submissions` collections. Active field types: text, email, number, textarea, select, checkbox, message.
- `FormBlock.astro` renders the form-builder field types as native HTML with explicit `for`/`id` label pairs. The form's `action` and `method` target the CMS endpoint for JS-off fallback. A bundled `<script>` POSTs JSON to `/api/form-submissions` and reveals the localized `confirmationMessage` or follows the configured redirect.
- Honeypot `fax` field hidden via a rule in `app.css`. Client-side time-trap stamps the submission payload as `_rendered_at` on script attach. The `spamGuard` `beforeChange` hook on `form-submissions` rejects honeypot-filled or under-1.5s submissions and strips both internal fields.

### SEO and meta

- `seoPlugin` adds `meta` (title, description, image) to Pages, Posts, and Authors. `generateTitle` falls back to `doc.title || doc.name`. `generateURL` resolves against `WEBSITE_URL`. The frontend `resolveSeo` falls back through `meta.title || doc.title || doc.name` and `meta.description || doc.excerpt`. Default OG image and the `robots.allowIndexing` toggle come from `SiteSettings`.
- `SEOMetadata.astro` emits `<title>`, canonical, hreflang per locale plus `x-default`, OG (type, title, description, url, site_name, locale, image with width and height and alt), and Twitter card tags. Title suffix from `siteSettings.defaultSeo.titleSuffix` only appends to non-empty titles. An empty title falls back to the site name alone.
- `JsonLd.astro` renders a `schema.org` graph via `astro-seo-schema`'s `<Schema>` component. Home pages emit `WebSite` plus `Organization`, posts emit `Article` (with author Persons, `datePublished`, `dateModified`, image), authors emit `Person`, anything else emits `WebPage`.
- Alternate localized paths come from `getStaticPaths` props, fetched once per build from the `/static-paths` endpoint. The dev-only SSR fallback in `/[lang]/[...path]` looks up alternates from `getStaticPathItems()` (the SDK cache is off in dev).
- `LanguageSwitcher.astro` renders one link per locale with `hreflang`, `aria-current` on the active locale, and uppercase labels. Mounted in `Header.astro` next to the primary nav.
- Sitemap split into a sitemap-index at `/sitemap.xml` and per-locale sitemaps at `/[lang]/sitemap.xml`. Each per-locale `<url>` carries `<lastmod>` from `updatedAt` plus `<xhtml:link rel="alternate">` for every populated locale and `x-default`.
- `robots.txt.ts` reads `DEFAULT_LOCALE` from the shared module, fetches `SiteSettings` in that locale, and emits `Allow: /` plus a `Sitemap:` line when `siteSettings.robots.allowIndexing` is true, otherwise `Disallow: /`.
- `getGlobalData` returns `siteSettings` alongside header, footer, and labels. `Layout.astro` consumes them in one round-trip and feeds them to `SEOMetadata` and `JsonLd`. `robots.txt.ts` fetches settings independently because it runs outside any layout. The Layout fetch honors the preview flag so cache is bypassed inside the preview iframe.

### Live preview

- Pages, Posts, and Authors enable `autosave: { interval: 1500 }` and opt into the admin's mobile, tablet, and desktop preview breakpoints. `payload-pages-plugin` auto-wires `admin.livePreview.url` via `generatePageURL`, which routes preview to `/preview/<lang>/<path>?previewSecret=...` on the Astro side. Public URLs are unchanged.
- `/preview/[lang]/[...path]` Astro route is server-rendered. It validates the supplied `previewSecret` against `PREVIEW_SECRET` with `crypto.timingSafeEqual` (403 on mismatch, 404 on unknown locale or path), then fetches drafts via a separate `previewPayloadSDK` carrying the preview API key. Responses set `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.
- `Layout.astro` accepts an optional `preview` context (`{ collection, id }`). When set, the body renders a fixed "Editing draft / Open in admin" toolbar (hidden inside the Payload iframe via `sec-fetch-dest`) and a `<LivePreviewListener>` that calls `@payloadcms/live-preview` `ready({ serverURL })` and full-reloads on `isDocumentEvent`. `CollectionLayout` threads the context to `PageLayout`, `PostLayout`, and `AuthorLayout`.

### Redirects and deploy hooks

- `web/src/cms/getRedirects.ts` runs while Astro evaluates its config and pulls the Redirects collection through the SDK. Each row converts to `{[sourcePath]: { destination: destinationPath, status: type === 'permanent' ? 301 : 302 }}`, which feeds Astro's `redirects:` map at build time. The file fails closed when `CMS_URL` or `PAYLOAD_READ_KEY` is missing in a production build (throws so the deploy aborts loudly) and fails open when the CMS fetch errors (logs a warning and returns `{}` so the build still ships). In dev or CI type-check with the env unset, it returns `{}` without a warning. `dotenv/config` fills `process.env` because Astro config evaluates before Vite loads `.env` for app code.
- Deploy webhook at `cms/src/hooks/triggerDeploy.ts`. `triggerDeployAfterChange` posts to `DEPLOY_HOOK_URL` only on the draft-to-published transition for Pages, Posts, and Authors. `triggerDeployAfterDelete` fires for deletion of a previously published doc. `triggerDeployAlwaysAfterChange` and `triggerDeployAlwaysAfterDelete` fire on every Redirects save and delete because that table has no draft state and is baked into the static output. `triggerDeployGlobalAfterChange` fires on any global change. All hooks share a 5-minute throttle keyed by `${collection}:${id}` or `global:${slug}` that fires the first event immediately and re-fires once at window close if any further events arrived. No-op when `DEPLOY_HOOK_URL` is unset. The single env var works for any plain webhook POST endpoint, including Railway, Vercel, and Coolify deploy hooks.
- `cms/.env.example` documents `DEPLOY_HOOK_URL` with example URL shapes for Railway, Vercel, and Coolify.
