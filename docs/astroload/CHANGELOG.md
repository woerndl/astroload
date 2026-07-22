# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Changed

- Dependency update: Astro 7.0.6 → 7.1.3, Payload and every `@payloadcms/*` package 3.85.0 → 3.86.0, Next 16.2.6 → 16.2.10 with matching `eslint-config-next`. Bug-fix releases throughout. Payload 3.85.2 patches a transitive `js-cookie` CVE and other audit findings, and 3.86.0 fixes the SDK's empty-array query serialization and the live-preview URL allow-list regex escaping. The Astro 7.1 minor adds only opt-in features. `payload-types.ts` is regenerated: the form builder's field descriptions became translatable upstream, so their static comments left the generated types.
  - **Upgrade notes:** Applying the diff and running `pnpm install` works as-is, the lockfile carries the resolution. A project that re-resolves instead (its own `pnpm add` or `pnpm update`) hits the 7-day publish cooldown for astro until 2026-07-27, pass `--config.minimumReleaseAgeExclude='astro,@astrojs/*'` for that install. With `trustPolicy: no-downgrade` it also fails on five aged transitive versions that predate npm provenance: `pino@9.14.0`, `undici-types@6.21.0`, `eslint-import-resolver-typescript@3.10.1`, `chokidar@4.0.3`, `semver@6.3.1`. Each was checked against its publisher account and GitHub tag before excluding. Pass one `--trust-policy-exclude='<pkg>@<version>'` per package. Run `pnpm --filter cms generate:types` after installing.

## [0.8.0] - 2026-07-21

### Added

- The web app serves Inter through the Astro Fonts API, fetched at build time and served first-party as subsetted WOFF2 under `/_astro/fonts/` with immutable caching. The shared layout preloads the latin uprights and Tailwind's `--font-sans` token reads the generated `--font-inter` variable. The web Dockerfile asserts that font files were emitted, because a provider metadata failure does not fail the build. The 404/500 CMS-down fallbacks stay on system fonts.
  - **Upgrade notes:** A project that chose its own font family keeps it and moves only the wiring: `fontProviders.local()` for licensed or branded files, the matching remote provider otherwise. A project still on the starter's system stack adopts Inter by applying the diff. Subsets follow the project's locale set. Compare text wrapping and page height before and after, a family or fallback change shifts metrics. Check every page that renders its own `<html>` (`rg -l "<html" web/src`): each needs its own `<Font>` tags or deliberately stays on system fonts. A project that ships a Content-Security-Policy must allow the inline style `<Font>` emits, through Astro's `security.csp` (which hashes page styles) or its own `style-src` values. Add the Dockerfile assert.
- The web app compresses its own responses: `web/server.mjs` wraps the standalone adapter handler with the `compression` package, which negotiates brotli or gzip per request. Its filter skips 206 and `Content-Range` responses, whose byte offsets refer to the uncompressed file. The `start` script and the Dockerfile CMD run the wrapper instead of `dist/server/entry.mjs`. Before, a host without a compressing proxy or CDN served every response uncompressed.
  - **Upgrade notes:** Copy `web/server.mjs`, add the `compression` dependency, and point the `start` script and the Dockerfile CMD at the wrapper. A project using the adapter's TLS mode (`SERVER_CERT_PATH`/`SERVER_KEY_PATH`) keeps `entry.mjs`, the wrapper speaks plain HTTP only. Skip the change when the deployment already compresses. Check with a GET against a page (not a HEAD, which the compression filter skips, and not the multi-locale root, whose bodyless 302 carries no encoding): `curl -sS -H 'Accept-Encoding: gzip' -D - -o /dev/null <page-url> | grep -i content-encoding`.
- `conventions.md` documents the starter's accessibility floor: text color tokens hold 4.5:1 contrast on every surface they render on, including large text, and interactive targets outside running text get at least 24 CSS px, with the visual size free to stay smaller.
  - **Upgrade notes:** A project that changed the palette or added controls runs the audit against its own values: every text token against every background it renders on, and a target-size sweep of non-inline interactive elements. The starter's measured results do not transfer.

### Changed

- `Img.astro` requires the `sizes` prop. The removed `100vw` default selected oversized variants for every image that renders narrower than the viewport, so each call site now states the width its CSS gives the image.
  - **Upgrade notes:** Audit `Img` call sites with `rg -n "<Img" web/src`, each needs an explicit `sizes`. Also audit raw `<img` tags pointing into `public/` with `rg -n '<img' web/src`. Verify every `sizes` branch, not only the phone tail: a changed breakpoint, column cap, or padding invalidates the desktop branch too. Compare the candidate width in `img.currentSrc` with `getBoundingClientRect().width * devicePixelRatio`, per image, instead of adopting the starter's values.

### Fixed

- The post cover, rich-text uploads, and the image block declared a `100vw` phone width while the shared layout pads its content column, so phones downloaded a larger image tier than rendered. All three now reference the new `CONTENT_COLUMN_SIZES` constant (`web/src/layout/contentColumn.ts`), which states the real width, `calc(100vw - 2rem)`, next to the column definition it derives from.
- Three interactive targets sat under the 24px minimum and now meet it without changing visible text size: the language-switcher links, the preview toolbar's open-in-admin link, and the checkbox-plus-label row in rendered forms. The language switcher's decorative `/` separator is hidden from screen readers. Every shipped text-color pair measured at or above 4.5:1, the lowest is `text-gray-500` on white at 4.84:1.

## [0.7.0] - 2026-07-21

### Removed

- The `/latest` demo route. The SSR opt-in shape it demonstrated (`prerender = false`, `staleOnError`, `Cache-Control: no-store`, `cacheHeader(false)`) is now a code example in `conventions.md`.
  - **Upgrade notes:** Applies to the demo route only. A project that turned `latest.astro` into a real route keeps its file.

### Added

- `GET /api/health` on the CMS answers 200 when a database query succeeds and 503 when it fails, so a healthcheck catches a running process that has lost its database connection. The cms healthcheck in `deploy/docker-compose.production.yml` now requests `/api/health` instead of `/admin`.
  - **Upgrade notes:** A healthcheck configured at the host against `/admin` moves to `/api/health`. With the database down, the 503 arrives only after the Mongo driver's server-selection timeout (30 seconds by default), so a probe with a shorter timeout reports the outage as a timeout instead.
- The 404 and 500 pages keep rendering when the CMS is unreachable: a failed labels fetch now falls back to hardcoded per-locale copy and logs the error. Before, the fetch threw and Astro showed its default error page. The fallback markup skips the shared layout and carries a `noindex` meta tag.
  - **Upgrade notes:** The fallback strings live inline in `web/src/pages/404.astro` and `500.astro` and cover `de` and `en`. A project with other locales or changed error copy extends the `fallback` map in both files. A locale without an entry falls back to English.
- The spam-guard hook rejects a form submission with more than 100 entries or an entry whose field name or value is longer than 10,000 characters, with the same generic 400 as its other checks. A single submission can then store about 1 MB of text. The hook limits stored submission fields only, request-body size limits and rate limiting belong at the host or proxy.
  - **Upgrade notes:** Only new submissions are affected, stored data is not touched. A project whose forms approach 100 fields or 10,000-character values raises `MAX_ENTRIES` or `MAX_VALUE_LENGTH` in `cms/src/hooks/spamGuard.ts`.
- Document in `deployment.md` the supported web hosts and the platform constraints to check before picking one: the web app builds for Astro's standalone Node adapter, so it runs on container platforms and Node hosts, while a serverless runtime such as Cloudflare Workers needs another adapter. Document there too that the admin account and API keys are created before the CMS hostname becomes public.
- Document in `content-workflow.md` that a seed or upload script run from a workstation against a deployed instance needs `MEDIA_DIR` pointed at a fresh temporary directory. Payload checks the local staticDir for duplicate filenames even with S3 storage, so a stale local file makes the new upload store under a `-1` suffix and filename-keyed lookups miss it.

### Changed

- The web image build takes `PAYLOAD_READ_KEY` as a declared build arg instead of a BuildKit secret mount, so builders without secret support (most PaaS build pipelines) can build the image. `PAYLOAD_PREVIEW_KEY` and `PREVIEW_SECRET` only have to be set, because `astro:env` checks that they exist when the prerender imports the preview SDK. The Dockerfile declares them with placeholder defaults, and the real values come from the runtime environment.
  - **Upgrade notes:** Build pipelines replace `--secret id=payload_read_key,env=PAYLOAD_READ_KEY` with `--build-arg PAYLOAD_READ_KEY=...`. A compose file copied from `deploy/docker-compose.production.yml` drops its `secrets:` blocks and passes `PAYLOAD_READ_KEY` under `web.build.args`. The preview placeholders need no wiring, their defaults live in the Dockerfile.
- With S3 configured, media is served through Payload's file route (`/api/media/file/*`) instead of directly from the bucket: the storage plugin call drops `disablePayloadAccessControl` and `acl: 'public-read'`. Stored URLs stay relative, the media collection's read access applies, and buckets without public-read ACLs or a public domain work. Direct serving stays available as an opt-in documented in `deployment.md`.
  - **Upgrade notes:** A project that wants to keep direct-from-bucket serving keeps the two removed lines. A project adopting the proxied default also backfills the absolute bucket URLs that direct mode persisted: find affected documents with `db.media.find({ url: /^http/ }, { filename: 1, url: 1, sizes: 1 })`, set `url` and the per-size `sizes.*.url` fields to their `/api/media/file/<filename>` form, then rebuild the web image so prerendered pages stop carrying bucket URLs. The bucket objects themselves need no change.

## [0.6.2] - 2026-07-20

### Added

- The `static-paths` endpoint logs a warning when two documents claim the same public path. Slug uniqueness is per collection, so a Page and a Post could hold the same path and the page lookup served whichever collection queried first, with nothing surfacing the collision.
- Document in `architecture.md` why the routes come from the CMS instead of Astro's `i18n` config, why the pages plugin's `alternatePathsField` stays unused, and how page identity stays on a Pages document when the layout is implemented in code.
- Document in `maintenance.md` how to add a locale to a site with existing content, and why read-time locale fallback does not make documents publishable in a new locale.
- Document in `content-workflow.md` that re-running an `upsertByKey` script overwrites newer editorial drafts unless the script skips existing documents or writes only empty fields, and that `payload run` exits without waiting for unawaited promises. Document in `forms.md` that the submit script toggles Tailwind's `hidden` class, which a project replacing Tailwind must define itself.

### Changed

- The `og:locale` map moved from `SEOMetadata.astro` into `cms/src/site-config.ts` (exported as `OG_LOCALE`), so a new locale is configured in the same file that defines it. A locale without an entry still emits no `og:locale` tag.
  - **Upgrade notes:** A project that added locales to the map inside `SEOMetadata.astro` moves those entries into `OG_LOCALE` in `site-config.ts`. Find local copies with `rg -n "OG_LOCALE" web/src`.
- Every CMS read carries a 15-second timeout: the SDK fetches and the redirect read at Astro config evaluation, whose retry loop a stalled connection could previously hold off forever. A stalled CMS now fails the build or the request instead of holding it until the host kills it. Routes that hold a last good response keep serving it through `staleOnError`.

### Fixed

- The web response cache entries now expire after 60 seconds. Without a TTL, request-time routes (the per-locale sitemaps, `/latest`) served whatever the size-bounded cache held until eviction or restart, so a published change could stay invisible on those routes indefinitely.
- The negotiated root redirect sends `Vary: Accept-Language` and `Cache-Control: no-store`, and locale negotiation skips `q=0` entries, which mean "not acceptable" per RFC 9110. Without the headers, a CDN could cache the first visitor's 302 and send every visitor to that visitor's language.
  - **Upgrade notes:** Multi-locale projects only. A single-locale project serves the home page at the root and never renders this redirect.
- A prerender build now fails when a document that `getStaticPaths` enumerated is no longer published, or its path changed, by the time the page loads it. Astro writes no file for a response with an empty body and reports success, so an unpublish or rename racing the build silently dropped that page from the deploy while the sitemap kept listing it.
  - **Upgrade notes:** A build that starts failing with `was enumerated but is no longer published` or `moved from ... during the build` hit content changes mid-build. Re-run the build. If it keeps failing, check whether a deploy hook fires again during builds.
- The web app checks that the static-paths endpoint returned an array before routes, sitemaps, and the home lookup consume it, so a wrong response fails with an error naming the endpoint instead of a type error mid-render.

## [0.6.1] - 2026-07-16

### Changed

- Rewrite source comments and `docs/` in a plainer, more neutral style, replacing figurative vocabulary with the literal mechanism. Prose only, no code changes.
- Correct statements the review found inaccurate: the seed's API keys are generated when their env vars are unset and missing keys produce 401 responses, the spam-guard timestamp must be older than the threshold rather than merely in the past, form submissions are stored in `form-submissions` with no review queue, the `content-build-id` meta tag appears only on pages rendered through the shared layout, and the `CONTENT_BUILD_ID` guidance no longer both requires and discourages setting it.
  - **Upgrade notes:** The corrected wording may have been copied into project-added comments or docs. Search with `rg -nU "review\W+queue|answers\W+403|any\W+past\W+timestamp"` (multiline, so a copy that wraps across comment lines still matches) and check each match against the corrected claims.

## [0.6.0] - 2026-07-14

### Added

- Add a `.astroload.yml` derivation marker. A derived project records the template commit and release tag it was scaffolded from and updates them after each verified sync.
  - **Upgrade notes:** An existing project creates the file by hand: set `upstream_commit` to the template commit of the last verified sync and `upstream_release` to its tag. A project that already tracks its base in a hand-rolled marker or in prose keeps that verified commit value and adopts this schema.
- Add `scripts/sync-inventory.mjs`. Run from a derived project, it lists upstream commits since the `.astroload.yml` base and a per-file state: `matches base`, `matches target`, `diverged`, `missing`, or `still at <old path>`. It has no dependencies and its tests run in `pnpm test`.
- Document the downstream sync workflow in `docs/astroload/updating.md`: run the inventory script, classify each commit, verify, then update the marker.
- Changelog entries now carry nested `**Upgrade notes:**` bullets when a derived project has to do more than apply the diff. `AGENTS.md` says when to write one, the release steps in `docs/astroload/maintenance.md` add a check for missed notes, and `docs/astroload/updating.md` has a sync read them from the base-to-target range first.
- Document static-asset placement in `docs/astroload/conventions.md`: component-owned art lives in `web/src/assets` and is imported, so it ships content-hashed under `/_astro/` and the Node adapter caches it as immutable. `web/public/` is only for files whose exact pathname outside consumers depend on. The adapter serves everything else in `public/` with `max-age=0`, so each browser reload waits on a revalidation round trip and paints the alt text until it answers.
  - **Upgrade notes:** The template has no assets to move, but a derived project may have added its own art under `web/public/`. Run `rg --files web/public`, then find each file's references with `rg -n -F '/<path-from-public>' web/src`. Move decorative assets to `web/src/assets` and import them (`?url` for SVGs rendered through `<img>`). Keep files whose exact public pathname is intentional.

### Changed

- Move the template's own dev Mongo to host port 27330 so a template checkout and a derived project do not share a database server by default.
  - **Upgrade notes:** Applies to the template checkout only. A derived project that already renumbered its dev Mongo port and database name per `docs/astroload/conventions.md` changes nothing.

### Fixed

- The analytics relay answered 500 instead of 204 when analytics is disabled or an event is dropped: `new Response('', { status: 204 })` throws in undici, which rejects a 204 with a non-null body. Both no-op responses now pass `null`.
  - **Upgrade notes:** The same pattern may exist in project-added routes. Run `rg -n "status: 204" web/src` and check that every hit passes `null` as the response body.

## [0.5.0] - 2026-07-11

### Added

- `cms/src/upsertByKey.ts`, the find-or-create-by-stable-key primitive that makes bulk content seeds idempotent. Its lookup includes drafts so an unpublished document is updated rather than shadowed by a new copy, and it throws when the key matches more than one document instead of updating an arbitrary one.

### Changed

- Auth bootstrap is split out of the demo seed. `seedAuth` mints the first admin and the two env-pinned API keys, skips whatever already exists, and runs standalone as `pnpm --filter @astroload/cms seed:auth` or as the demo seed's first step. A project that deletes the demo seed (which ships known credentials) no longer deletes the only path that provisions a fresh database, where every web read answered 403 and the strict build failed. The admin account takes `PAYLOAD_ADMIN_EMAIL`/`PAYLOAD_ADMIN_PASSWORD` from the env and warns when it falls back to the demo credentials.
- The stock Astro favicon is replaced with the Astroload mark, white on a purple-gradient tile, shipped as `favicon.svg` and a regenerated multi-resolution `favicon.ico`.
- The `staleOnError` helper logs the read failure it swallows, so a CMS that keeps failing while a route serves its last good response is visible in the server logs instead of silent. The `latest.astro` stale notice no longer asserts the CMS is unreachable, since the read can fail for other reasons.
- Posts stamp `publishedAt` with the current time on their first publish when the field is left blank, instead of publishing with an empty date. A later publish keeps whatever value is set.
- A half-configured S3 or Resend env group now logs a startup warning naming the missing variables, instead of silently leaving the integration off when one variable of the group is set. The integration still turns on only when its whole group is present.
- The Header and Footer share one nav-link field definition, and the CMS dropped a handful of inert config (`dbName` on the Labels global, `saveToJWT` on the API-key type, an unused `SITE_NAME` re-export). The list-block published-relation lookup reads at `depth: 0` with an id-only select, since it uses only the ids.
- The web data layer single-sources its wire types from the CMS endpoints (`GlobalData`, `StaticPathItem`) instead of restating them, and the two catch-all page routes share one `loadCatchAllPage` helper instead of duplicating the id/path resolution and global-data overlap. The `global-data` and `static-paths` endpoints dropped their ETag/304 machinery, which no client ever sent an `If-None-Match` against, and `cachedFetch` strips the internal `X-Use-Cache` marker before the CMS request and keys the cache on url plus auth identity only (GET-only, so method and body were constant).
- The web dev server ships the pinned port the conventions doc already prescribed: `server: { port: 4321 }` with `strictPort` under `vite.server`, so a second dev server refuses to start instead of hopping to the next free port while a stale process keeps answering the pinned URL. Renumber the port per project.
- The dev compose binds MongoDB to `127.0.0.1` instead of all interfaces (the dev mongod runs without auth) and documents the per-project host-port and database-name convention: like the web dev port, renumbering the Mongo port per project turns a cross-project mixup into connection refused instead of silent reads and writes against another project's data.
- The dev and production compose files run MongoDB 8 instead of 7. The adapter setup is unchanged (standalone, transactions disabled), and the README stack notes follow.
- The CI workflow pins its actions to commit SHAs (with the version in a comment) so a moved tag cannot swap the code the workflow runs, and grants the default token `contents: read` only.

### Removed

- The GraphQL endpoint and playground. Nothing in the template consumes GraphQL (the web app and the seed use REST and the Local API), and every unauthenticated query surface needs its own access review, so the config sets `graphQL: { disable: true }` and the generated `api/graphql` route handlers are deleted. Restore both if your fork needs GraphQL.

### Fixed

- The `/preview` route renders again. The 0.4.0 key scoping made the global-data endpoint reject preview reads from the read-only key, but the web layer still requested preview globals with that key, so every preview render failed. Global-data preview reads now use the preview-scoped SDK, the same key the page read already uses.
- Preview renders no longer leak `/preview/...` URLs into the page head: JSON-LD and `og:url` are omitted in preview, alongside the canonical link that already was. The language switcher inside preview now targets the document's translation instead of the locale home, and hreflang alternates stay suppressed there.
- In a multi-locale build, `/{not-a-locale}/sitemap.xml` answered 500: the per-locale sitemap was a prerendered dynamic endpoint, and the Node adapter routes an unmatched param on such an endpoint into the renderer instead of a 404. The route now renders on demand in every build, so its locale guard answers with a 404, and the per-locale sitemaps track publishes without waiting for a redeploy.
- The per-locale sitemap emits hreflang alternates only when more than one locale is configured, matching the page head, so a single-locale build with `FORCE_URL_PREFIX` no longer lists self-referential alternates. Its `x-default` follows the head too: it names the default locale's translation and is omitted when that translation is missing, instead of falling back to an arbitrary locale.
- Slug-change redirects work on single-locale sites. The CMS records them against the stored `/${locale}/...` path, which an unprefixed site never serves, so every automatic redirect missed. The redirect table now strips the locale prefix from source and destination, a no-op for multi-locale builds.
- The seed no longer assumes the locale set: its base pass writes 'de' when the project ships it and the default locale otherwise, so a project that dropped 'de' can still seed. A force reseed aborts when a bulk delete leaves documents behind instead of seeding on top of them, and works when site-settings was never saved. The demo contact form is now localized like the rest of the seed content (German labels with an English overlay).
- The analytics proxy relays events for this site only: a POST whose `payload.website` is not the configured `UMAMI_WEBSITE_ID` answers 403 instead of being forwarded, so the endpoint cannot be used as an open relay to Umami. Header forwarding switched from a deny-list to an allow-list (User-Agent and `x-umami-cache`), which drops geo-spoofing headers by default instead of by enumeration.
- Rich-text link validation matches what the renderer can render. The validator rejects ASCII control characters (browsers strip them while resolving a URL, so `/\t/evil.com` navigated off-origin as `//evil.com`) and backslashes (browsers treat them as slashes, so `/\evil.example` navigated off-origin too), validates the raw value the renderer will resolve instead of a trimmed copy, and rejects anchors, queries, and bare hostnames at save time instead of storing links the web sanitizer then silently unwraps to plain text. Both layers now share one scheme allow-list.
- The first user registered on an empty instance becomes an admin. Payload's first-user registration bypasses field access, so the roles field's `editor` default saved and the fresh deploy was locked out of every admin-only surface (creating users, API keys, redirects). The editor role can now edit: Pages, Posts, Authors, Media, the four globals, and Redirects accept writes from both roles, where before every write was admin-only and `editor` was a read-only label. User and API-key management stays admin-only. The published-content filter for API keys is fail-closed now: every key type except `preview` reads published content only, instead of only the `read-only` type being filtered.
- The Forms collection now follows the same rules as the content it becomes part of: writes are role-gated (the plugin sets no write rule, so any authenticated requester, including the web app's api keys, could rewrite a form's notification emails or redirect, or delete it), form saves and deletions fire the deploy webhook so the prerendered pages that embed the form rebuild, and the radio field type is dropped from the builder because the web renderer would show it as a text input.
- The production compose scaffold shows how to pass the optional web build args: commented `UMAMI_WEBSITE_ID` and `CONTENT_BUILD_ID` entries under the web service, and a header note that the publish hook must pass a fresh `CONTENT_BUILD_ID` or a same-commit `docker compose build` replays the cached prerender. Previously the scaffold offered no way to reach either build arg.
- The deploy webhook no longer fires on saves that cannot change the published output: a manual Save Draft over a published document (only autosaves were skipped before, and the parent document a draft save never touches stays as it was) and a re-publish with no edits. Unpublish still fires, and the check keeps erring toward firing, so a redundant build is the failure mode rather than a stale site.
- The language switcher marks the current locale's link with `aria-current="page"` instead of the generic `"true"`, so a screen reader announces it as the current page.
- The page-by-path endpoint could answer with locale-keyed objects (rendered as `[object Object]`) instead of localized values: its render fetch and its all-locales path lookup ran concurrently on one shared request, and Payload's local API writes each call's locale onto that request in place, so the path lookup's `all` locale could overwrite the render fetch's. The path lookup now runs on its own request with the same user and access control.
- The spam guard's internal field names (`fax`, `_rendered_at`) are now reserved: the Forms collection rejects a form that names a field after either, so an editor's field can no longer collide with the honeypot and turn every real submission into a spam rejection. Duplicate field names are rejected at save time too. Submission errors shown to visitors are now always the localized generic label. Server messages were English regardless of the page locale. Input ids stay unique when the same form renders twice on a page.

## [0.4.0] - 2026-07-10

### Added

- A vitest setup in the web app, run with `pnpm test`. The first test covers the link sanitizer that keeps rich text from failing on a link the renderer cannot resolve.
- An optional `CONTENT_BUILD_ID` build env, stamped into every page the shared layout renders as `<meta name="content-build-id">`. Pointed at a value that changes per deploy, it keeps a same-commit redeploy (a publish-driven rebuild on an unchanged git SHA) from replaying a cached build and serving stale prerendered HTML. Left unset, the tag is omitted. The maintenance guide carries the contract and per-host recipes.
- An opt-in pattern for the few public routes that must stay current without waiting for a rebuild: `prerender = false`, a read through the new `staleOnError` helper, and `Cache-Control: no-store`. Such a route renders on demand and serves the last good response when the CMS read fails. `web/src/pages/latest.astro` is the worked example. Static rendering stays the default for every other route.
- Uploaded images are converted to WebP (the `xs` through `lg` variants and the main file), and `Img.astro` emits a responsive `srcset` with a `sizes` per call site. The `og` social-card crop stays JPEG for scraper compatibility, for sources smaller than the crop too. Every media url carries a `?v=updatedAt` marker and the media route sends a 30-day `Cache-Control` (deliberately not `immutable`, so the max-age bounds the one case the marker cannot see, a variant regeneration that leaves `updatedAt` untouched), so an updated file gets a fresh url and is never served stale. The maintenance guide notes the CDN query-string requirement this relies on.
- Internal links inside the preview keep you in preview. A capture-phase click handler rewrites internal navigation to the matching `/preview/{lang}` route and carries the preview secret, so clicking through a draft no longer drops to the public, published page. It handles locale-prefixed and locale-stripped links alike.
- A `content-workflow.md` doc and a gitignored `cms/src/scripts/scratch/` lane for one-off content-mutation scripts. The doc names the admin UI, MCP, and REST as the paths for changing content, and sorts the scripts that belong in the repo from the ones that never should.
- Optional Umami analytics, on when `UMAMI_WEBSITE_ID` is set. The tracker script and the collect endpoint are proxied through first-party routes (`/u.js`, `/api/send`), pageviews are tracked explicitly per `astro:page-load` so view transitions report the right URL, and preview traffic is excluded. The proxy targets Umami Cloud by default, and `UMAMI_HOST_URL` points it at a self-hosted instance instead. Umami is cookieless and stores nothing on the visitor's device.
- A Dockerfile per app, a `deploy/docker-compose.production.yml` scaffold to copy, and a `deployment.md` guide. The CMS image builds Next in standalone mode (gated on `NEXT_OUTPUT=standalone` so the plain `next start` path stays warning-free) and stores uploads under a `MEDIA_DIR` volume. The web image bakes the built site in, so a content publish means a rebuild. Both images pin the `.nvmrc` Node version, the web runtime layer carries production dependencies only, and the compose scaffold healthchecks both services and starts the web container once the CMS reports healthy.

### Changed

- The SEO plugin reads its page-collection list from the shared `pageCollectionsSlugs` constant instead of repeating the slugs, so the list has one source of truth and a new page collection is covered for SEO without a second edit.
- Moved the upstream docs into a single `docs/astroload/` subtree (the five reference docs, the docs index as `index.md`, and `CHANGELOG.md`), and parked the landing README at `docs/README.md`. GitHub renders `.github/README.md` or a repo-root `README.md` ahead of `docs/README.md`, so a derived project can add its own root `README.md`, `CHANGELOG.md`, and docs and have them take precedence. Those root locations are no longer occupied by the template, so a derived project can own its documentation without colliding with upstream files when it syncs.
- Upgraded the web app to Astro 7, with the matching `@astrojs/node` 11 adapter and `astro-seo-schema` 7. `compressHTML` is pinned to `true` (the Astro 6 behavior) because Astro 7's new `'jsx'` default collapses inter-element whitespace and would change rendered output.
- The default database is now MongoDB, through `@payloadcms/db-mongodb`, in place of Postgres. The adapter runs with transactions disabled (`transactionOptions: false`), so a single standalone `mongod` is enough, and `docker-compose.yml` ships one with a `mongosh` healthcheck. Document ids change from integers to MongoDB ObjectId strings, which the regenerated Payload types reflect. Postgres stays available as a documented alternative. The maintenance guide covers the switch-back steps and how to move existing data.
- The build-time redirects fetch retries with backoff on a strict deploy build before giving up, so a CMS that is briefly unreachable while a coordinated deploy restarts it no longer aborts the build on the first error. A sustained outage still fails the strict build by design, which leaves the last good deploy serving rather than replacing it with a redirect-less one. Non-strict runs (dev, `astro check`, plain `astro build`) read a committed `web/src/cms/redirects.fallback.json`, empty by default, giving offline builds an optional place to keep a redirect table.
- Public content reads that render document paths go through a single `findPublicDocs` helper that strips the stored locale prefix from every returned document, its breadcrumbs, populated relations, and rich-text links, giving the strip one place to be right. Reads with no rendered path (redirects, the title-only SSR example) stay direct.
- The lexical block renderer and the page section renderer (`SectionBlock.astro`) each dispatch through a typed map of the block types they handle, so adding a type to either union without a renderer fails the build. A block added only on the editor side still throws at render time until both sides are added together, which the conventions doc now spells out.
- `JsonLd.astro` documents the upgrade path from the generic Organization publisher to LocalBusiness, for projects that are a physical business.
- CI runs the web test suite (`pnpm test`) on every push and pull request, alongside the existing lint and typecheck steps.
- `pnpm check` typechecks both workspaces: `tsc --noEmit` in the CMS and `astro check` in the web app. CI runs the same combined step, so a CMS-side type error fails the pipeline.
- The list blocks' published-relation lookup passes `req` through to its nested find, so the read joins the request's transaction.
- `cross-env` is a CMS devDependency and the unused `dotenv` dependency is gone from the CMS. Neither is needed in the runtime image.

### Removed

- The hidden `plausibleDomain` SiteSettings field and the `PLAUSIBLE_DOMAIN` web env. Both were inert placeholders that nothing rendered. Analytics is now the Umami integration above.

### Fixed

- Replacing or deleting a media file triggers a site rebuild. The Media collection wired no deploy hook, so an updated or removed image left the prerendered pages pointing at the old file until an unrelated publish rebuilt them. Media now fires the same rate-limited deploy webhook the content collections use, coalesced through the existing build window.
- Rich text renders without error when a draft has an empty body or contains a link to a document that is missing or unpublished. A link that cannot resolve is shown as its plain text instead of failing the page render.
- A publish burst across many documents now coalesces into a single rate-limited build instead of one throttle window per document, so a multi-document publish can no longer fan out into overlapping builds. The deploy hook fires once on the first deploy-worthy save and at most once more per window while saves continue. Autosave draft writes, and global or always-deploy saves that change nothing but `updatedAt`, no longer trigger a build.
- Draft version history on pages, posts, and authors is now capped at 50 versions per document through a shared `draftVersions` config, so frequent autosaves no longer grow the stored history without bound.
- The bare CMS root `/` now redirects to the admin panel instead of returning a 404.
- The preview toolbar is sticky rather than fixed, so it reserves space in the layout instead of overlapping the page header.
- The Media upload directory is pinned to an absolute path inside the cms package (overridable via `MEDIA_DIR`). Payload resolves a relative `staticDir` against the process working directory, so a server started from the repo root read and wrote a different directory than one started from `cms/`.
- In a single-locale project, `/{anything}/sitemap.xml` returned a 500. The prerendered `[lang]` route patterns registered with zero generated files, and the Node adapter answers such a pattern with its error page instead of falling through to a 404. Single-locale builds now render the `[lang]` routes on demand, so their locale guards 404 those URLs.
- Per-route render-mode overrides live in a small `prerenderOverrides` Astro integration, because Astro only honors a literal `export const prerender` and silently ignores a computed one. The integration is what makes the single-locale `[lang]` fix above hold, restores on-demand rendering in dev so CMS edits show without an Astro restart, and renders the multi-locale root redirect per request so its `Accept-Language` negotiation works.
- The CMS env validation no longer auto-skips when `CI=true` is set. Only an explicit `SKIP_ENV_VALIDATION` opts out, so a host that exports `CI` at runtime cannot boot the server past the check.
- Small SEO and accessibility corrections: an image without alt text renders `alt=""` instead of no attribute, `og:locale` is omitted when the language has no known territory mapping instead of inventing one, the preview route no longer declares a canonical URL, and the layout links the shipped favicons.
- `web/.env.example` states that the seed always logs the API key values, and `cms/.env.example` shows where to pin `PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` so a reseed keeps the values the web app carries.

### Security

- The `page-by-path`, `global-data`, and `static-paths` endpoints now run their CMS reads with access control enabled (`overrideAccess: false`) instead of letting the Local API bypass it. A read-only API key is held to published content, and `page-by-path` and `global-data` answer a `?preview=true` request from a key that may not read drafts with a 403 rather than serving the draft.
- Version history is restricted to panel users through a `readVersions` rule on Pages, Posts, and Authors. Payload leaves version reads open to any authenticated requester when the rule is unset, and version documents are not filtered by publish status, so a read-only API key could reach drafts through the generated `/versions` routes.
- Form submissions are validated against their referenced form on the server, so a submission that omits a required field is rejected with a 400 instead of stored. A required checkbox must be ticked and every other required field must carry a non-empty value. A duplicate field name or an unknown form id gets the same generic rejection. The check runs after the existing spam guard.
- Form-submission access rules are pinned in the plugin overrides. Submissions hold visitor PII, and the plugin's defaults leave read open to any authenticated requester (including the web app's read-only API key) and set no delete rule at all. Read is now limited to panel users and delete to admins, with update blocked as before.
- The `global-data` response is marked `Cache-Control: private`. It requires an API key, so a shared cache must not serve it across clients.

### Documentation

- New conventions entries: render-mode overrides belong in the `prerenderOverrides` integration because the `prerender` export must stay literal, a pinned dev port needs `strictPort` under `vite.server`, and display-changing state classes use compound selectors. `architecture.md` states that no adapter layer sits between the two apps, and the maintenance guide flags that Railway's build cache may ignore a changed `CONTENT_BUILD_ID`.

## [0.3.3] - 2026-05-31

### Changed

- Pinned the dev/CI Node version to 22.22.3 (latest 22.x LTS) in `.nvmrc`, and switched CI to read it via `node-version-file` instead of a hardcoded version.

## [0.3.2] - 2026-05-31

### Changed

- Updated Payload to 3.85.0 and Astro to 6.4.2, including all `@payloadcms/*` packages and the `@astrojs/node` adapter (10.1.2).

## [0.3.1] - 2026-05-31

### Changed

- Global data (header, footer, labels, site settings) is fetched once per request. `getGlobalData` memoizes the in-flight fetch on `Astro.locals`, keyed by locale and preview, so the page layout and the outer layout share one web-to-CMS request for it instead of fetching separately. Callers without a request scope (build-time prerender, endpoints) still fetch directly.
- Each page route starts the global-data fetch alongside resolving the page, so the two requests overlap instead of running one after the other. On a not-found request the started fetch is observed but not awaited, so it cannot turn a 404 into a 500.
- The `page-by-path` endpoint returns the matched document's `path` in every locale. The home route in development and the catch-all fallback paths read alternate-locale paths from that response instead of from the static-paths list, and in development the home page is resolved by path, while the prerendered build still uses the list. `toPublicPaths` moved into `stripLocalePath.ts`, shared by the static-paths and page-by-path endpoints.

## [0.3.0] - 2026-05-31

### Added

- `cms/src/site-config.ts` is the single source of truth for the shipped locale set (`LOCALES`, `DEFAULT_LOCALE`), the per-locale admin labels, the build-time `SITE_NAME`, and the derived `LOCALE_URL_PREFIX` flag (`LOCALES.length > 1`). Both apps read these four names through it: the CMS re-exports them from `shared.ts`, and the web app re-exports them from `web/src/cms/types.ts`.
- A project that ships a single locale now serves un-prefixed public URLs (`/about` instead of `/de/about`). The CMS still stores the `/{locale}` path, which is normalized away at the web ingress by `stripLocalePath`, so switching a project between one and several locales is a config-only change with no content migration. Multi-locale projects keep the `/{locale}` prefix and are byte-for-byte unaffected.
- An optional `FORCE_URL_PREFIX` override in `site-config.ts`. A single-locale project can set it to `true` to keep the `/{locale}` prefix, so its URLs survive adding a second locale later with no redirects. The language switcher and `hreflang`/`x-default` tags key off whether more than one locale ships (`MULTIPLE_LOCALES`) rather than off the prefix, so a forced-prefix single-locale site serves prefixed URLs without a single-option switcher or self-referential `hreflang`. Forcing the prefix off while several locales ship is rejected at import, since their un-prefixed URLs would collide.

### Changed

- `payload.config.ts` derives its `localization.locales` from `LOCALES` instead of a hardcoded array, so changing the shipped locale set is a one-line edit in `site-config.ts`. The boot-time guard that reconciled the Payload locale list against `shared.LOCALES` is gone, since a single source can no longer drift from itself.
- The Payload admin title suffix now reads ` — ${SITE_NAME}` from `site-config.ts`.
- The web app resolves pages through both a prefixed `[lang]/[...path].astro` and an un-prefixed `[...path].astro` route tree, choosing one via `LOCALE_URL_PREFIX`. When a single locale ships, the home route, language switcher, sitemap, JSON-LD, the canonical/hreflang tags, and the admin's links to published pages all drop the locale prefix. Admin live preview stays prefixed in every configuration.
- Both sitemap routes build their XML through a shared `web/src/cms/sitemap.ts` helper instead of each re-implementing entry escaping and document assembly.

## [0.2.0] - 2026-05-30

### Added

- A GitHub Actions workflow (`.github/workflows/ci.yml`) that runs lint and type-checks on push and pull request.
- A `SKIP_ENV_VALIDATION` flag in `cms/src/env.ts` that bypasses the boot-time env check, so commands like type generation can run without a populated `.env`.

### Changed

- `PostsListBlock` and `AuthorsListBlock` now build their virtual relationship through a shared `publishedRelationField` factory instead of repeating the `afterRead` hook. Both still return all published items in the current locale, sorted by the per-block sort key.
- The live-preview autosave interval lives in `cms/src/shared.ts` as `AUTOSAVE_INTERVAL`, and Pages, Posts, and Authors reference it instead of repeating the literal.
- `payload.config.ts` asserts at boot that its localization locales match the `LOCALES` set from the shared module, throwing if they differ, and sources its `defaultLocale` from `DEFAULT_LOCALE`, so the CMS and web sides can no longer drift apart silently. `pickLocale` now imports `isLocale` and `DEFAULT_LOCALE` from the shared module rather than keeping its own copy.
- Hardcoded UI strings now come from the Labels global instead of being inlined. The home and language navigation labels, the empty-list messages for the post and author list blocks, and the form's submit, sending, and error text are all editor-controlled, and the unused label fields were removed.
- `Img.astro`, `PreviewToolbar.astro`, and the SDK factory resolve CMS URLs through the shared `absoluteCmsURL` helper instead of building `new URL(...)` inline.
- The `page-by-path` endpoint looks up candidates by slug at depth 0 selecting only the `path` field, then loads the single matched document at full depth, so colliding slugs in other collections are never populated. Its 404 response now carries the same `Cache-Control: no-cache` as the hit path.
- `getPageData` dropped its unused `preview` option and always reads published content. The preview route fetches drafts through its own SDK.
- The collection deploy hooks in `triggerDeploy.ts` route through a single `post` helper, and `JsonLd.astro` selects the `WebPage` branch with an explicit `pages` check rather than a catch-all `else`.
- The seed script wraps its typed insert payloads in a small `seedData` helper instead of scattering `as never` casts.

### Fixed

- The Lexical link feature validates URLs against a scheme allowlist (`http`, `https`, `mailto`, `tel`, or a relative path), rejecting `javascript:`, `data:`, and protocol-relative `//host` links before they are stored. As a second guard, the web renderer unwraps any link with a dangerous href to plain text, covering content that never passes through the editor (seeds, imports, database restores).
- `spamGuard` fails closed: a form submission whose `submissionData` is not an array is rejected with a 400 and logged, instead of being saved unchecked.
- The deploy webhook now fires whenever the published output changes, including an unpublish or a direct re-publish of a live document, not only the first draft-to-published transition. Pure draft saves are still skipped and the per-document throttle absorbs autosave churn.
- Post publication dates format in the page locale instead of a fixed one.
- JSON-LD image dimensions are emitted as numbers, which is what Google expects for `width` and `height`.
- Header and Footer navigation links resolve through a shared `resolveNavLinks` helper that drops any link whose target is an unpopulated relation or has no path, and the block and upload renderers guard relations with `isPopulated` before reading them.

### Documentation

- Documented the seeded admin credentials and recommended changing them after the first sign-in.
- Corrected the README's hreflang description and the claim about re-running the seed.
- Smaller documentation fixes: capitalized the Astroload product name, simplified some wording, corrected the CI status note, and made several code comments plainer.

## [0.1.2] - 2026-05-28

### Fixed

- The web deploy build now aborts when the redirect fetch errors instead of silently shipping an empty redirect table. A `REDIRECTS_STRICT` flag, set by the web `build` script, gates this so a missing env var and a failed CMS fetch fail symmetrically on a deploy build, while `astro check` and dev still degrade to an empty redirect table.
- The web app ships an env-overridable `start` script (`HOST`/`PORT`, defaulting to `0.0.0.0:4321`), so the documented production deploy command works against the Node standalone server.
- `FormBlock` resolves the page locale from the route and renders its sending and error strings in that locale, with the submit-label fallback localized too, instead of hardcoding English. The submit button still shows the form's CMS `submitButtonLabel` when one is set, so a German page now renders German status text where it previously showed English.
- The `/preview` route sets `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer` on the responses it returns: the 403, both 404s, a failed draft fetch, and the rendered page. The `previewSecret` stays out of `Referer`, and preview output is neither cached nor indexed. A render-time exception still falls through to Astro's error page without these headers. `security.md` documents the edge rule that closes that gap.

### Documentation

- Documented that the web app's `astro:env/client` public values (`CMS_URL`, `WEBSITE_URL`, `PLAUSIBLE_DOMAIN`) are baked in at `astro build`, so the app must be built with production values rather than having them injected at runtime.
- Removed the README's no-JS form fallback claim. The forms and deployment sections now state that submission goes through a client-side script and requires JavaScript, matching `docs/forms.md`.
- Corrected the redirect source collection name in the README (`Redirects`, not `Pages`), added the build-time-env caveat to the README env list, and removed the stale "JS-off fallback" reference from the docs index and the AGENTS.md routing list.

## [0.1.1] - 2026-05-27

### Documentation

- Public-facing docs under `docs/`: `architecture.md` (system shape, service boundaries, decoupling trade-offs), `conventions.md` (rules for contributors and LLM agents), `forms.md` (form surface, cross-origin POST, spam guard, JS-off fallback), `maintenance.md` (failure modes that are not obvious from reading the code), `security.md` (threat model, residual risks, hardening to add before production), with an index at `docs/README.md`.
- Architecture section in the root `README.md` and in `docs/architecture.md` § Service boundaries, with a Mermaid service-boundary diagram covering `Editor → cms → Postgres`, `cms → web`, and `Visitor → web`. The root section also carries the workspace directory tree.
- `AGENTS.md` as the single source of agent guidance for any coding agent using the repo, with `CLAUDE.md` reduced to a one-line `@AGENTS.md` reference. AGENTS.md carries the no-banner-separator-comments rule and a routing list that points at the `docs/` files by topic keywords.

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
- `cachedFetch` (`web/src/cms/sdk/cachedFetch.ts`) backs the SDK with a module-scoped `lru-cache` bounded at 1024 entries and 32 MiB total. The cache key includes a SHA-256 hash of the `Authorization` header (truncated to 16 hex characters) so rotating an API key invalidates old entries and the raw secret never lands in cache keys or diagnostics. The cache is disabled in dev so CMS edits propagate without an Astro restart.
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
