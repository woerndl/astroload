# Maintenance

Failure modes that are not obvious from reading the code.

## Schema changes to globals can wipe localized data in dev

Payload's dev mode uses Drizzle's `push` to sync the schema. When you
change a global's shape (add a required field, change a field type, add a
localized group), `push` may need to recreate the localized side table.
If that table already has rows, you will see a prompt that warns about
data loss and asks for confirmation. Accepting destroys the localized
rows for that global. The columns are added and the rows come back empty
across all locales. There is no recovery short of re-seeding or
repopulating by hand.

Two cases to distinguish:

- Fresh install. The seed runs after the schema is created. There is no
  existing data to lose. Safe.
- Existing install. The schema is already in place with content. A new
  required global field triggers the destructive prompt. Take a database
  backup before answering `y`. Re-run the seed (or write a one-off
  populate that calls `payload.updateGlobal` per locale) to restore the
  localized values.

For production, use migrations. Generate one with `payload migrate:create`
and apply it with `payload migrate`. Migrations let you add columns with
default values and avoid the destructive push path. The safe upgrade flow
when adding a required field to an existing global is: generate a
migration, apply it with a default or a backfill step, optionally tighten
to NOT NULL in a second migration once rows are populated.

## Default locale lives in two files

The default locale is pinned in two places that must stay in sync:

- `cms/src/payload.config.ts` `localization.defaultLocale: 'en'` drives
  Payload's fallback locale for content reads.
- `cms/src/shared.ts` `DEFAULT_LOCALE: Locale = 'en'` drives sitemap
  `x-default` emission and is consumed by the Astro side through
  `@astroload/cms/src/shared`.

The duplication is intentional. Payload's config is server-only. The
shared module crosses the workspace boundary and lands in the Astro
client bundle. There is no runtime assertion that the two match. A
mismatch does not produce a build error. It produces a wrong
`hreflang="x-default"` link in production sitemaps, which Google either
ignores or attributes to the wrong locale.

If you swap the default (or add a new locale and pick it as default),
change both lines. If this ever bites somebody, the right fix is a
boot-time check that compares the value `shared.ts` exports against the
generated `Config['locale']` defaults.

## Deploy webhook throttles per document

The deploy hook (`cms/src/hooks/triggerDeploy.ts`) coalesces bursts. The
first publish event fires immediately. Subsequent events for the same
document during the window update a pending slot. The window close fires
that pending payload. Continuous editor activity caps at one POST per
window per document.

The window is set in code, not env. The default is tuned for hosts that
bill per build minute, where editors publishing in bursts should not
trigger one build per save. If you want snappier or stricter behaviour,
change the constant. If the throttle window is shorter than the build,
you get overlapping builds.

The hook fires on three events: a draft published, a published doc
deleted, and any global changed. It targets `DEPLOY_HOOK_URL` and posts a
small JSON payload with no auth header.

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
transition (Redirects do not use drafts). The fire path still goes
through the same per-document throttle as `triggerDeploy`, so editor
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

The fetch handles missing env vars and missing CMS in two different
ways:

- If `CMS_URL` or `PAYLOAD_READ_KEY` is missing in production
  (`NODE_ENV === 'production'`), the function throws so the build
  fails loudly.
- If either is missing in dev or in a type-check job, the function
  returns `{}` with no warning. A non-production build boots with no
  redirects.
- If the env vars are set but the CMS fetch fails, the function logs
  a warning and returns `{}` so the build still succeeds.

If you want a warning in dev too, add a `console.warn` to the
no-env-vars branch in `getRedirects.ts`.

Source paths in the collection must be the exact string the URL router
sees, locale prefix included. There is no pattern matching at this layer.
If the adapter ever changes to a static host (Cloudflare Pages, Netlify
static), the same code path produces static redirect files with no
changes.

## Lexical internal links do not switch to the preview URL

The rich text renderer does not pass a `resolveInternalLink` callback to
`<RichTextLexical>`. Internal links inside rich text use whatever `path`
the pages plugin stored on the linked document (for example, `/en/about`).
In published mode that path is correct.

In preview mode the same internal link still points at `/en/about`, not
`/preview/en/about`. Clicking it from a preview pane navigates the editor
away from the preview session into the published site. The preview route
itself keeps working. Only inline links inside rich text content slip out.

This is acceptable for the starter because the seeded content does not
include cross-page Lexical links. If a downstream project relies on
internal links in body content and editors expect preview navigation to
stay inside preview, pass a resolver to the renderer that prepends
`/preview` when the page is rendered in preview mode.

## Lexical blocks supported in this starter

`web/src/components/lexical/BlockRenderer.astro` only renders the `image`
block. Other block types added to the Lexical editor will throw at render
time with `Lexical block "<type>" not implemented`. Add a case to the
renderer when you introduce a new inline block.

## Divergent locale slugs in seed content

The seed deliberately uses different slugs per locale (`ueber-uns` vs
`about`, `kontakt` vs `contact`, `hallo-welt` vs `hello-world`). The
divergence exercises the per-locale `path` field from the pages plugin
and the language switcher's path-mapping. A sitewide string-replace
would not work for translating URLs. The plugin emits the right path per
locale and the switcher reads it from `Astro.props.paths`. Keep the
divergence when editing the seed.

## API key reseed trap

The seed reads `PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` from the
CMS process env. If either is unset, the seed generates a random value
instead. In both cases the keys it ends up using are logged to stdout
at the end of the seed run. Those values must match `web/.env` or the
frontend sees silent 401s.

When you drop the database and re-run the seed, the keys stay stable
only if both env vars are pinned in the CMS env. If they are absent,
every reseed mints fresh values. The safe default is to set
`PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` in `cms/.env` after the
first seed, mirror them in `web/.env`, and leave them there.

## Astro dev does not re-fetch prerendered routes on every request

In `astro dev`, prerendered routes don't re-run `getStaticPaths` on
every request, and the SDK has its own response cache. Live content
edits do not propagate to dev pages until the dev server is restarted,
unless the route opts into SSR with `export const prerender = !import.meta.env.DEV;`.

The content catch-all in this template uses `!import.meta.env.DEV`
exactly for that reason. If you are editing in admin and not seeing
changes on `localhost:4321`, check whether the route is prerendered in
dev.
