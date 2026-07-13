# Maintenance

Failure modes that are not obvious from reading the code.

## Schema changes do not migrate existing documents

The MongoDB adapter stores documents without a fixed schema, so changing a
field's shape never runs a migration or rewrites what is already stored.
There is no dev-time schema push and no destructive prompt: adding,
removing, retyping, or renaming a field leaves existing documents exactly
as they were.

The catch is that old documents keep their old shape:

- A newly required field is simply absent on documents saved before it
  existed. They read back without it and fail validation only the next
  time something saves them (an admin edit, a hook), so nothing flags the
  gap until then.
- A renamed field orphans the old key's data rather than moving it. The
  new name reads empty.
- A retyped field can leave stored values that no longer match the new
  type.

Localized fields are stored per locale, so none of this wipes locale data,
but a backfill has to set each locale. There is no automatic migration: to
reshape or backfill existing documents, write a one-off script in the
scratch lane (see [`content-workflow.md`](./content-workflow.md)) that
reads each document and re-saves it through the Local API, or re-run the
seed. Take a database backup first on an install that already holds real
content.

## Locale set and default locale live in one file

`cms/src/site-config.ts` is the single source for the shipped locale set
(`LOCALES`) and the default (`DEFAULT_LOCALE`). `cms/src/shared.ts`
re-exports both, `payload.config.ts` derives `localization.locales` and
`localization.defaultLocale` from them, and the Astro side reads them
through `web/src/cms/types.ts`. The sitemap `x-default` emission and the
public page lookup anchor on the same `DEFAULT_LOCALE`, so the Payload
config can no longer drift from the value those consumers read.

`site-config.ts` asserts at import that `DEFAULT_LOCALE` is one of
`LOCALES`. A default outside the shipped set fails fast at import, instead
of silently producing wrong paths and a wrong `hreflang="x-default"` link
in production sitemaps.

To swap the default, or to change which locales ship, edit
`site-config.ts`, then regenerate the CMS types
(`pnpm --filter @astroload/cms generate:types`) so the generated `locale`
union tracks the new set. Nothing else changes in lockstep.

By default a project carries the `/{locale}` URL prefix only when it ships more
than one locale. To keep the prefix on a single-locale project, so its URLs
survive adding a second locale later with no redirects, set `FORCE_URL_PREFIX`
to `true` in `site-config.ts`. Forcing it off while several locales ship is
rejected at import, because their un-prefixed URLs would collide.

## Publishing to a live static build

The web app ships prerendered HTML. Publishing in admin does not change
the live site on its own. It posts to `DEPLOY_HOOK_URL`, the host rebuilds
and redeploys, and the new build goes live. Publish-to-live latency is the
host's build and deploy time, on the order of minutes, not instant. There
is no per-request CMS read on the published path, which is the trade for
that latency.

The deploy hook (`cms/src/hooks/triggerDeploy.ts`) coalesces bursts with a
single process-global window, not one window per document. The first
deploy-worthy save fires the webhook immediately. Every further save during
the window collapses into one pending deploy that fires when the window
closes. A burst inside one window costs at most two builds: one leading, one
trailing. Saves that keep arriving after a trailing fire open a fresh window,
so sustained activity costs one build per window for as long as deploy-worthy
saves continue, not a flat cap of two.

The hook fires whenever the published output changes: a doc that is or was
published changed (publish, re-publish, or unpublish), a published doc
deleted, and any global or always-deploy collection (Redirects, Forms,
Media) changed.
Saves that cannot change the live output are skipped: draft saves (autosave
or a manual Save Draft, even over a published doc), a re-publish with no
edits, and global or always-deploy saves that leave the document identical
apart from `updatedAt`. The skip check errs toward firing, since a missed
change ships a stale site while a redundant fire only wastes a build. The webhook targets `DEPLOY_HOOK_URL` with a small JSON body
and no auth header.

The window (`WINDOW_MS`) is set in code, not env. The default suits hosts
that bill per build minute. Shorten it for faster publishing, lengthen it to
batch harder. A window shorter than the build time can overlap builds.

Rebuild now: to skip the wait, trigger the host's redeploy (its dashboard
button, or `curl -X POST "$DEPLOY_HOOK_URL"`). A manual rebuild always picks
up the current published state.

Edit bursts: a long editing session coalesces to the leading build plus one
trailing build per window while it lasts. Edits made after the last trailing
build fires are not deployed until the next deploy-worthy save or a manual
rebuild. When you finish a burst, confirm the live site reflects your last
change and rebuild if it does not.

Time-relative content: a static build freezes content at build time. Pages
that show relative dates ("posted 3 days ago") or that should reveal a
future-dated post drift until the next build. Schedule a periodic rebuild on
the host (a daily cron hitting `DEPLOY_HOOK_URL`) so time-sensitive output
stays current without an editor action.

Restart hazard and latch recipe: the throttle window lives in process
memory. A trailing deploy queued when the CMS process restarts (a redeploy
of the CMS itself, a crash, a scale-to-zero) is lost. The leading deploy is
not affected because it fires synchronously. To guarantee no publish is
dropped without adding database-backed deploy state, latch a low-frequency
scheduled rebuild on the host as a backstop: a periodic `DEPLOY_HOOK_URL`
POST eventually ships any change a lost trailing deploy missed. The same
cron that covers time-relative content covers this.

## Same-commit redeploys and the content build id

A publish-driven rebuild runs on the same git commit as the last one, only
the CMS content differs. Hosts that cache build output keyed on the commit
SHA can serve the previous build for that second deploy, so the new content
never reaches the edge. The site looks stuck on stale HTML even though the
deploy "succeeded".

The seam against this is `CONTENT_BUILD_ID`. Set it to a value that changes
every deploy and the web build stamps it into every page as
`<meta name="content-build-id">`, so the output genuinely differs build over
build. The contract for an operator:

- Pass a fresh `CONTENT_BUILD_ID` on each deploy (the host's deploy id, a
  timestamp, the build number). Most hosts hash build env vars into the
  build cache key, so a changing value forces a real rebuild. Where the host
  does not, disable build caching for the web service instead.
- Verify after a publish-driven deploy by reading the meta tag
  (`curl -s https://your-site/ | grep content-build-id`). A changed value
  confirms the redeploy rebuilt rather than replayed a cached build.

Host recipes:

- Railway: set `CONTENT_BUILD_ID=${{ RAILWAY_DEPLOYMENT_ID }}` (or another
  per-deploy variable) on the web service. Unverified whether Railpack
  hashes build env into its build-layer cache key, so check the meta tag
  after the first publish-driven redeploy and disable build caching for
  the service if the value did not change.
- Vercel/Netlify: set `CONTENT_BUILD_ID` to the deploy id env the platform
  exposes, or turn off build cache for the project.
- Coolify/Docker hosts: pass `--build-arg CONTENT_BUILD_ID=$(date +%s)` or an
  equivalent unique value at build time. The compose scaffold in
  `deploy/docker-compose.production.yml` carries a commented
  `CONTENT_BUILD_ID` build arg for this.

Leaving `CONTENT_BUILD_ID` unset omits the meta tag and disables the seam.
That is fine when the host already rebuilds cleanly per deploy. Set it only
if you observe a same-commit redeploy serving stale HTML.

## Media is served WebP and cached hard, busted by a version marker

The Media collection converts uploads to WebP (`xs` through `lg` and the main
file), keeping the `og` social-card crop as JPEG because some scrapers still do
not render a WebP `og:image`. `Img.astro` emits a responsive `srcset` from the
generated widths, so pass a `sizes` that matches the rendered box (the call
sites already do).

The media file route sends `Cache-Control: public, max-age=2592000`, so a CDN
or browser may cache a media url for 30 days. That is only safe because every
media url the web app emits carries a `?v=<updatedAt>` marker
(`versionedMediaURL`), which changes when the file changes and so produces a new
url. The header is deliberately not `immutable`: the max-age bounds the one case
the marker cannot see, a script that regenerates variant bytes without touching
the document's `updatedAt`. Two operational consequences:

- A CDN in front of the CMS must keep the query string in its cache key. If it
  strips query strings, an updated image keeps serving stale because every
  version resolves to the same cached key. Most CDNs include the query string by
  default. Confirm before fronting media.
- Any new code that builds a media url must go through `versionedMediaURL`, not
  `absoluteCmsURL`, or it opts that url out of cache busting.

## Redirects load at Astro config evaluation, not at request time

`web/src/cms/getRedirects.ts` runs from `astro.config.mjs` and fetches the
Redirects collection over the CMS API. The result is passed into Astro's
top-level `redirects` option. With the Node standalone adapter the rules
end up in the server manifest and apply at request time with no extra
round-trip.

Consequence: editing a redirect in admin has no effect until the next
deploy. The Redirects collection registers
`triggerDeployAlwaysAfterChange` on save and
`triggerDeployAlwaysAfterDelete` on delete. These fire unconditionally
on any save or delete in that collection, not on a draft-to-published
transition (Redirects do not use drafts), but a save that leaves the
document unchanged apart from `updatedAt` is skipped. The webhook call goes
through the same global throttle as every other deploy trigger, so editor
bursts coalesce. A configured `DEPLOY_HOOK_URL` means redirects refresh
automatically. An unset hook means an editor must trigger a manual
deploy.

`getRedirects.ts` imports `dotenv/config` at the top because Astro loads
`.env` through Vite after the user config is evaluated. Without that
import, `process.env.CMS_URL` and `process.env.PAYLOAD_READ_KEY` are
undefined at the moment `getRedirects()` runs, the function returns
`{}`, and the dev server boots with no redirects even though `.env` is
on disk. Anything else added to `astro.config.mjs` that reads
`process.env` needs the same treatment.

The fetch keys its behaviour on the `REDIRECTS_STRICT` flag, which the
`build` script in `web/package.json` sets so a normal
`pnpm --filter @astroload/web build` is strict:

- A failed CMS fetch retries with backoff under strict (six attempts over
  roughly a minute and a half), to ride out a CMS that is briefly down while
  a coordinated deploy restarts it. Non-strict makes a single attempt.
- If the CMS is still unreachable after the strict retries, the build fails
  loudly rather than shipping a redirect-less site. The last good deploy is
  already serving, so failing leaves it in place instead of replacing it with
  a build that 404s every removed URL. A missing `CMS_URL`/`PAYLOAD_READ_KEY`
  fails the same way, since that is a wiring error, not an outage.
- A non-strict run (dev, `astro check`, plain `astro build`) makes one
  attempt and then returns the committed fallback so the run still ships.
- The CMS is trusted when it answers. An empty Redirects collection produces
  an empty table, in strict and non-strict alike, so deleting every redirect
  takes effect rather than being overridden.

Strictness keys on the flag instead of `NODE_ENV` because `astro check`
forces `NODE_ENV=production` while resolving the config. Keying on
`NODE_ENV` would then make a type-check abort on a transient CMS outage.
The flag scopes the retry effort and the fail-loud policy to the deploy build
alone.

This is a build-time policy, independent of runtime resilience. The running
standalone server has no request-time dependency on the CMS for redirects or
prerendered content (see above), so a CMS outage does not take the live site
down.

`redirects.fallback.json` is the committed redirect table for non-strict runs
(offline dev and CI). It ships empty, which a fresh project loses nothing by.
It also doubles as an availability backstop: an operator who would rather
keep a deploy alive through a CMS outage than fail it can populate the file
(export the Redirects collection into it) and return `fallback` instead of
throwing in the final strict branch of `getRedirects.ts`.

Source paths in the collection must be the exact string the URL router
sees, locale prefix included. There is no pattern matching at this layer.
If the adapter ever changes to a static host (Cloudflare Pages, Netlify
static), the same code path produces static redirect files with no
changes.

## Public web env is baked in at build time

`CMS_URL`, `WEBSITE_URL`, and `UMAMI_WEBSITE_ID` are declared as
`astro:env/client` public values in `web/astro.config.mjs`. Astro inlines
public values into the build output at `astro build`. Running the built
standalone server later with a different env does not change them, because
they are already compiled into the JS.

Consequence: a build produced against staging or localhost URLs keeps those
URLs in production even when the deploy environment "sets" the right values.
The CMS's server-side secrets behave the opposite way, since the running
process reads them from its environment at runtime. There is no code change
to make here. Build the web app with the production values of these three
vars. Splitting individual server-only consumers onto `astro:env/server` is
a separate, optional decision and does not remove the need to build with
correct public URLs.

## Host cutover runbook

Taking the site live, or moving it to a new host, touches two public hostnames
and one build-cache trap. Work through these in order.

Two hostnames are public, not one. The web origin (`WEBSITE_URL`) serves visitors.
The CMS origin (`CMS_URL`) is also public: every media url the web app emits
points at it, so each `<img>`, the `og:image`, and the sitemap resolve through
the CMS host. A CMS reachable only on a private network renders a site with broken
images and social cards. Both hostnames must resolve over HTTPS from the public
internet.

1. Build with production values. `CMS_URL`, `WEBSITE_URL`, and `UMAMI_WEBSITE_ID`
   are inlined at `astro build` (see [Public web env is baked in at build
   time](#public-web-env-is-baked-in-at-build-time)). Set them to the production
   hostnames before the build, not at `start`.
2. Set the CMS origin on both sides. The CMS service must run with
   `SERVER_URL=https://<cms-host>`, which Payload uses as its own public origin
   for admin csrf and absolute urls. The web build's `CMS_URL` must point at the
   same host. A mismatch breaks the admin session or sends the site's media and
   API at the wrong origin.
3. Point DNS at each host. The web app and the CMS each need their hostname
   resolving to the right host. On Railway a custom domain also needs the
   `_railway-verify.<domain>` TXT record shown in the service's domain settings,
   in addition to the CNAME. The domain stays unverified and unserved until that
   TXT resolves, and a CNAME alone is the common reason a fresh domain returns
   nothing.
4. Guard the build cache. A publish-driven redeploy runs on the same git commit
   as the last one, so a host that caches build output by commit can replay stale
   HTML. Set `CONTENT_BUILD_ID` per deploy (see [Same-commit redeploys and the
   content build id](#same-commit-redeploys-and-the-content-build-id)).
5. Verify the cutover. Load the public web origin over HTTPS. Confirm an image
   renders, which proves `CMS_URL` is publicly reachable and built in correctly.
   Publish a content change and confirm the live site updates and the
   `content-build-id` meta tag changes
   (`curl -s https://your-site/ | grep content-build-id`), which proves the
   redeploy rebuilt rather than served a cached build.
6. Check response compression. The web app's Node server sends uncompressed
   responses and relies on the host's proxy or CDN to compress. Confirm with
   `curl -sI -H 'Accept-Encoding: gzip, br' https://your-site/ | grep -i content-encoding`.
   If nothing comes back, the host does not compress at the edge and needs a
   compressing proxy in front, or every page ships uncompressed HTML.
7. Verify analytics, when `UMAMI_WEBSITE_ID` is set. In a browser, confirm
   exactly one POST to the first-party `/api/send` per page view. A request to
   the Umami host (`gateway.umami.is` or `cloud.umami.is` on Cloud) instead
   means the tag's `data-host-url` did not take. Confirm the realtime dashboard shows the
   visitor's correct country and that no cookies are set. Every visitor
   reporting the server's country means the host exposes the client IP under a
   header other than `x-real-ip` (see `web/src/pages/api/send.ts`).

## Lexical internal links do not switch to the preview URL

The rich text renderer does not pass a `resolveInternalLink` callback to
`<RichTextLexical>`. Internal links inside rich text use whatever `path`
the pages plugin stored on the linked document (for example, `/en/about`).
In published mode that path is correct.

In preview mode the same internal link still renders `/en/about`, not
`/preview/en/about`. The click is caught anyway:
`web/src/components/PreviewNav.astro` intercepts internal navigation on
preview pages and rewrites it to the matching `/preview` route with the
secret attached, so following the link stays inside preview. Only the
rendered href is the published path, which matters if a link is copied out
of the page rather than clicked. To make the markup itself preview-aware,
pass a resolver to the renderer that prepends `/preview` when the page is
rendered in preview mode.

## Lexical blocks supported in this starter

`web/src/components/lexical/BlockRenderer.astro` only renders the `image`
block. Other block types added to the Lexical editor throw at render time with
`Lexical block "<type>" not implemented`. The renderer keeps a typed map of the
block types it handles: adding a type to that map's union without a renderer
fails the build, but a block added only on the CMS side is invisible to the
compiler and still throws at runtime. Add the editor block, the union entry,
and the renderer in the same change. See the block-to-renderer coupling note
in [`conventions.md`](./conventions.md).

## Divergent locale slugs in seed content

The seed deliberately uses different slugs per locale (`ueber-uns` vs
`about`, `kontakt` vs `contact`, `hallo-welt` vs `hello-world`). The
divergence exercises the per-locale `path` field from the pages plugin
and the language switcher's path-mapping. A sitewide string-replace
would not work for translating URLs. The plugin emits the right path per
locale and the switcher reads it from `Astro.props.paths`. Keep the
divergence when editing the seed.

## API key reseed trap

The auth seed (`pnpm --filter @astroload/cms seed:auth`, also the first
step of the demo seed) reads `PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY`
from the CMS process env. If either is unset, the seed generates a random
value instead. A key's value is logged to stdout only when the seed
creates it. A rerun that finds the keys in place logs nothing and changes
nothing. The values in use must match `web/.env` or the frontend sees
silent 401s.

When you drop the database and re-run the seed, the keys stay stable
only if both env vars are pinned in the CMS env. If they are absent,
every reseed mints fresh values. The safe default is to set
`PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` in `cms/.env` after the
first seed, mirror them in `web/.env`, and leave them there.

## Astro dev does not re-fetch prerendered routes on every request

In `astro dev`, prerendered routes don't re-run `getStaticPaths` on
every request, and the SDK has its own response cache. Live content
edits do not propagate to dev pages until the dev server is restarted,
unless the route renders on demand in dev.

The `prerenderOverrides` integration in `astro.config.mjs` therefore
flips every route to on-demand while the dev server runs. Note that a
conditional prerender export (`!import.meta.env.DEV` and the like)
does not do this: Astro's route scanner only honors a bare literal and
silently ignores anything else, so the override has to happen in the
integration. If you are editing in admin and not seeing changes on
`localhost:4321`, check whether the route is prerendered in dev.

## Database is MongoDB, with Postgres as an option

The CMS runs on MongoDB through `@payloadcms/db-mongodb`. The adapter sets
`transactionOptions: false`, which turns transactions off. Transactions need a
replica set, so disabling them lets the starter run a single standalone
`mongod` (the `mongo` service in `docker-compose.yml`) with no replica-set
setup, and avoids the WriteConflict retries a replica set would otherwise need
under concurrent writes.

If you do want transactions, run Mongo as a single-node replica set
(`mongod --replSet rs0`, then `rs.initiate()` once), point `DATABASE_URI` at it
with `?replicaSet=rs0`, and remove the `transactionOptions: false` line in
`cms/src/payload.config.ts`.

### Moving data between Mongo databases

Document ids are MongoDB ObjectId strings, so a dump from one Mongo database
restores cleanly into another:

```bash
mongodump    --uri "$DATABASE_URI" --out ./dump
mongorestore --uri "$TARGET_URI"   ./dump
```

There is no automatic path from Postgres rows to Mongo documents. To carry
existing Postgres data over, export it and re-import it through Payload's API
or a one-off script, the same way the seed writes content.

### Staying on Postgres

Postgres is still a first-class option. To switch back:

1. In `cms/package.json`, replace `@payloadcms/db-mongodb` with
   `@payloadcms/db-postgres` at the same Payload version, then `pnpm install`.
2. In `cms/src/payload.config.ts`, swap the import and the `db` adapter:

   ```ts
   import { postgresAdapter } from '@payloadcms/db-postgres'

   db: postgresAdapter({
     pool: { connectionString: env.DATABASE_URI },
   }),
   ```

3. Point `DATABASE_URI` at Postgres
   (`postgres://astroload:astroload@127.0.0.1:5432/astroload`) and restore a
   Postgres service in `docker-compose.yml`.
4. Re-run `pnpm --filter @astroload/cms generate:types`. Ids switch from
   `string` back to `number`. The web app types ids as `string | number`, so
   no frontend code changes.

## Cutting a release

Versions follow SemVer, and `CHANGELOG.md` follows Keep a Changelog:
new work accumulates under `## [Unreleased]` as it lands. Cutting a
release is three steps, in order.

1. Promote the changelog. Before renaming, check every non-doc entry
   in the section against the `**Upgrade notes:**` cases in
   `AGENTS.md`. Notes are easy to miss at fix time because the author
   sees the template code, not the derived projects. Add the missing
   ones, and add a note where two entries affect each other, for
   example when one must be applied before the other. Then rename
   `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and leave a fresh
   empty `## [Unreleased]` above it. This goes in its own commit, with
   no code in it:

   ```bash
   git commit -m "docs: release X.Y.Z in CHANGELOG"
   ```

2. Tag that commit. Tags are lightweight and named `vX.Y.Z` (note the
   `v`, which the commit subject omits):

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Create the GitHub release against the tag. The title is the bare
   tag, `vX.Y.Z`, with no summary suffix. Write the body to stand on
   its own for an outside reader: base it on that version's changelog
   section, drop any internal shorthand, and keep the prose plain.
   Normal releases are neither drafts nor prereleases.

   ```bash
   gh release create vX.Y.Z --verify-tag --title "vX.Y.Z" \
     --notes-file <notes>
   ```

The changelog entry is the canonical record. The GitHub release body is
a reader-facing summary of the same change, not a second source of
truth.
