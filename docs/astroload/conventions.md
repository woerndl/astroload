# Conventions

Rules that hold across the codebase. LLM agents follow them as written.
Human contributors follow them too and can push back on any rule that no
longer makes sense.

## Comments stand on their own

Code comments and commit messages must not reference internal plans or
their labels, issue numbers, ids of internal findings or patterns, or any
docs that may not be in the repo. If a rule matters at a call site, write the
rule there. Stable upstream URLs and committed top-level files are fine to
cite. Comments outlive the docs they reference, so "see internal note X"
breaks when that note is renamed or moved.

## No AI slop in committed text

Applies to code comments, commit messages, README, error messages, and any
public-facing prose. Watch in particular for em dashes,
semicolons in prose, bold-first bullets, "not X but Y" parallelism,
rhetorical questions of the form "the X? a Y.", magic adverbs (quietly,
fundamentally, deeply), "serves as" or "represents" instead of "is", and
unicode arrows or smart quotes. Banner-style separator comments
(`# --- Section ---`, `// ===== Foo =====`) also belong on this list.

## Render-mode choices live at the top of the file

Astro only honors a bare literal in a prerender export. Anything
conditional (`!import.meta.env.DEV`, a ternary on config) is silently
ignored and the route falls back to the default. So every route in the
template uses one of two literal shapes:

- `export const prerender = true` for routes that are static in prod.
  The content catch-alls, the home page, the root sitemap, and
  `robots.txt` use this.
- `export const prerender = false` for routes that must run per request.
  The 404 and 500 pages, the per-locale sitemap (before `@astrojs/node` 11.1.2 a
  prerendered dynamic endpoint answered unknown locales with a 500
  instead of a 404),
  the analytics relay routes (`u.js`, `/api/send`), and anything under
  `/preview` are in this group.

Every conditional case lives in the `prerenderOverrides` integration in
`astro.config.mjs`, Astro's supported way to override render modes per
route. It renders everything on demand in dev (so admin edits show up
without a restart), the `[lang]` routes on demand in a single-locale
build, and the root on demand in a multi-locale build (the
Accept-Language redirect needs the request). If a new route needs a
conditional render mode, extend that integration rather than computing
the export.

A small subset of the second shape is the on-demand opt-in: a public route
that must reflect the latest content without waiting for a rebuild (a live
listing, a dashboard). It uses the same `prerender = false`, wraps its CMS
read in the `staleOnError` helper (`web/src/cms/staleOnError.ts`), and sets
`Cache-Control: no-store`. The helper serves the last good response when the
CMS read fails, so an outage degrades that one route instead of failing it,
and logs the swallowed error so the failing read stays visible. On a cold
start with nothing cached the error still propagates, so the route shows its
normal error page rather than a blank success. Here is that shape, a live
listing of the newest posts:

```astro
---
import { payloadSDK } from '../cms/sdk'
import { cacheHeader } from '../cms/sdk/cachedFetch'
import { staleOnError } from '../cms/staleOnError'
import { DEFAULT_LOCALE } from '../cms/types'

export const prerender = false

// An on-demand route must not be cached at the edge, or it stops being live.
// Set before the await so a cold-start failure response stays uncacheable.
Astro.response.headers.set('Cache-Control', 'no-store')

const { data: posts, stale } = await staleOnError('latest-posts', async () => {
  // cacheHeader(false) bypasses the cross-request LRU so each request is live.
  const result = await payloadSDK.find(
    {
      collection: 'posts',
      locale: DEFAULT_LOCALE,
      where: { _status: { equals: 'published' } },
      sort: '-publishedAt',
      limit: 5,
      pagination: false,
    },
    { headers: cacheHeader(false) },
  )
  return result.docs
})
---

{stale && <p>Showing the last known content. The latest could not be loaded.</p>}
<ul>{posts.map((post) => <li>{post.title}</li>)}</ul>
```

A read that renders document paths must go through `findPublicDocs` so the
stored locale prefix is stripped. Keep this set small. Static prerendering
stays the default for everything else.

If you add a new route, pick the right shape and write it at the top of
the file.

## A pinned dev port needs strictPort under vite.server

Astro's top-level `server` option accepts `port` but ignores keys it does
not know, so `server: { port: 4321, strictPort: true }` pins the port
without the strictness. When the port is taken, the dev server hops to the
next free one and a stale process keeps answering the pinned URL. Put the
flag in Vite's config, which Astro passes through:

```js
server: { port: 4321 },
vite: { server: { strictPort: true } },
```

With `strictPort` in place, a second dev server on the same port refuses
to start instead of moving to the next port.

## Each project's dev Mongo gets its own host port and database name

The dev mongod runs without auth, and Mongo creates any database named in
the connection string on first write. So when two projects publish the
same host port, whichever container happens to be running answers for
both: a dev server or seed pointed at this project can read from or, with
`SEED_FORCE`, wipe another project's data without any error. This starter
publishes `27330` rather than the Mongo default, so a fresh checkout does
not collide with a stock local Mongo on the default port. When you derive
a project, add two guards:

- Renumber the host port in `docker-compose.yml` per project (the
  container side stays `27017`) and keep `DATABASE_URI` in `cms/.env` on
  the same number. A wrong or missing container then fails with connection
  refused instead of silently answering.
- Give each project its own database name in `DATABASE_URI`. Even on a
  shared mongod, writes then go to separate databases.

The compose file also binds the port to `127.0.0.1`. Keep it, because a
mongod without auth published on `0.0.0.0` is reachable from the local
network. Production is unaffected: the production compose gives Mongo no
host port at all.

## Styles live in cascade layers

`web/src/styles/styles.css` names the layers in this order:
`astro.images, tokens, base, components, utilities`. A later layer wins
over an earlier one, whatever the specificity. `tokens.css` holds the
custom properties, `base.css` the reset and element defaults. Each
component keeps its scoped rules in `@layer components { ... }`, and
`utilities` holds the few rules that must win over every component, such
as `[hidden]`. A rule outside any layer wins over all layers, so a
component style without the `@layer components` wrapper overrides the
utilities.

The first layer that the browser sees sets the order. The bundled
stylesheet can open with a component's `@layer components` block, so
`LayerOrder.astro` repeats the layer statement in an inline `<style>`.
Every `<head>` renders `<LayerOrder />` right after `<meta charset>`:
`Layout.astro`, `styleguide.astro` and the fallback heads of `404.astro`
and `500.astro`. A new page with its own `<html>` adds it too.
`web/e2e/styles.e2e.ts` checks that the statement comes before any style
or stylesheet on a built page. Change the statement in `styles.css`,
`LayerOrder.astro` and `web/e2e/styles.e2e.ts` together, and update its
hash in the commented-out `security.csp` block of `web/astro.config.mjs`.
`web/src/components/layerOrder.test.ts` checks the hash.

## The styleguide page shows type, the form block and an image

`web/src/pages/styleguide.astro` is a prerendered page at `/styleguide`.
It renders `FormBlock.astro` from a fixture form in its frontmatter, and
its image comes from `astro:assets`. It reads nothing from the CMS,
renders its own `<html>` with `<LayerOrder />` and `<Font>`, has a
`robots` `noindex` meta tag, and stays out of the sitemaps, which list
CMS documents only. Add the project's own components to this page.

## Display-changing state classes use compound selectors

A modifier that flips visibility (`.menu.is-open { display: flex }`) must
be written as a compound selector so it outranks the base rule. Two
single-class rules have equal specificity, and the tie resolves by source
order, which is not stable between the dev server and the production
bundle. A toggle that works in dev can lose the tie after bundling, and
the failure only shows up on the built site.

## Style a child component through its props, custom properties or root class

A scoped rule in a parent that uses `:global()` matches every element its
selector names inside its child components, so it also styles markup the
parent's author did not write. For example, a `:global(li)::before` rule
in a prose wrapper gives `position: absolute` to the `::before` bullets
of a block rendered inside the wrapper. Style a child through one of
these instead:

- a prop that the child turns into its own scoped style,
- a custom property set on the parent's wrapper and read in the child's
  CSS,
- a `class` passed to the child, which puts it on its root.

A parent's scoped class rule matches the child's root only if the child
spreads its remaining props onto that root, as `Img.astro` does. The
spread carries the parent's `data-astro-cid-*` attribute.

Use `:global()` only for the page itself (`html`, `body`) and for the
direct children of an element the component renders. The section
spacing rule in `PageLayout.astro` is the example: it matches each
element directly inside `.page-sections`. A rich text section renders no
wrapper, so the rule also spaces its paragraphs.

## A component with an optional slot takes a boolean prop

`Astro.slots.has('name')` reports whether the parent's markup contains an
element with `slot="name"`, not whether that element renders content.
`has()` in `astro/dist/core/render/slots.js` returns
`Boolean(this.#slots[name])`. On Astro 7.4.1 it returns `true` for each of
these, even when `show` is false:

```astro
<Card>{show && <p slot="footer">...</p>}</Card>
<Card><Fragment slot="footer">{show && <p>...</p>}</Fragment></Card>
<Card><p slot="footer">{show ? text : ''}</p></Card>
```

A component with an optional slot takes a boolean prop and uses `??` to
fall back to `Astro.slots.has()`, not `||`, so a `false` from the parent
wins:

```astro
---
const { hasFooter } = Astro.props
const showFooter = hasFooter ?? Astro.slots.has('footer')
---
{showFooter && <footer><slot name="footer" /></footer>}
```

A parent whose slot content depends on a condition passes the same
condition as `hasFooter`: `<Card hasFooter={show}>`.
`web/test/slotFallback.test.ts` renders the three examples and the prop
through the Astro container API, with its fixtures in
`web/test/fixtures/`. If an Astro upgrade changes what `has()` returns,
the test that expects a footer when the condition is false fails.

## Static art is imported, public/ is for fixed pathnames

Put component-owned images in `web/src/assets` and reference them through
imports. The build emits them under `/_astro` with a content hash in the
filename, and the standalone Node adapter serves that directory with
`Cache-Control: public, max-age=31536000, immutable`, so a reload takes
the file straight from the browser cache.

Files in `web/public/` keep their literal path and the adapter serves
them with `max-age=0`, which makes the browser revalidate on every use.
Each reload then waits on a conditional request before painting, and
container builds rewrite mtimes, so every deploy also invalidates every
client's cached copy at once. Keep a file in `public/` only when outside
consumers depend on its exact pathname or conventional filename. In this
template those are the two favicons and `apple-touch-icon.png`. A fixed
pathname with generated content is a route, like `robots.txt.ts`, and does
not need `public/`. If a project adds a web manifest, set
`"display": "browser"` in it, so Chrome shows no automatic install prompt
for the site ([install criteria](https://web.dev/articles/install-criteria)).

For local raster images prefer Astro's `<Image>` and `<Picture>`
components, which take the same `src/assets` imports and add dimensions
and format handling. CMS-hosted images stay on the Payload variant path
through `Img.astro`. For an SVG rendered through `<img>`, import it with
`?url`. Astro turns a bare `.svg` import into an inline component, which
leaks the file's `<style>` blocks and ids into the page. Vite inlines
`?url` assets smaller than `assetsInlineLimit` (4096 bytes) as data URIs.
That is fine as an `<img>` src. Append `&no-inline` when the result must
stay an HTTP URL, for example one handed to external consumers.

## Rendered images state their real width

No rendered `<img>` points at a full-size `public/` asset. CMS media
renders through `Img.astro`, whose `sizes` prop is required: every call
site states the width the CSS gives the image, derived from the
layout's width rules. `100vw` stays valid only as an explicit
claim for an image that really spans the viewport. A shared layout that
pads its content column makes the phone width `calc(100vw - <padding>)`,
not `100vw`, and the difference is enough to push the browser across a
variant boundary and download an image tier larger than needed. Images
spanning the shared layout's column reference the `CONTENT_COLUMN_SIZES`
constant in `web/src/layout/contentColumn.ts`, which owns that arithmetic
in one place.

Verify a declared `sizes` value against the measured rendered width at a
phone viewport, per image rather than only the first one on the page: in
the console, compare the candidate width encoded in `img.currentSrc`
against `img.getBoundingClientRect().width * devicePixelRatio`. The chosen
candidate should be the smallest one at or above that product.

Code-owned raster assets go through `astro:assets` `<Image>` or
`<Picture>`, or live in the CMS like any other photo. Both components use
`sharp`, a dependency of the web workspace. `web/astro.config.mjs` sets
`image: { responsiveStyles: true, layout: 'constrained' }`, so each one
gets a `srcset` and `sizes` for its layout. The generated `sizes` claims
`100vw` on a phone, so one inside the content column passes
`sizes={CONTENT_COLUMN_SIZES}`. Astro puts its image styles in the
`astro.images` cascade layer, the first layer in the order (see "Styles
live in cascade layers"). Choose output format and dimensions per image
from the rendered CSS size and the device pixel ratios the project
supports.

## The largest contentful paint image gets the priority prop

`Img.astro` loads lazily and decodes asynchronously by default. The
`priority` prop marks the page's largest contentful paint image: it
loads eagerly with `fetchpriority="high"`
([web.dev](https://web.dev/articles/optimize-lcp)) and decodes
synchronously. Set it on one image per page at most, because two images
with high priority compete for the same bandwidth. `PostLayout.astro`
sets it on the post cover.

## Webfonts go through the Fonts API

Fonts are configured in the top-level `fonts` array in
`web/astro.config.mjs`. Astro fetches them from the provider at build time
and serves them first-party as subsetted WOFF2 under `/_astro/fonts/`, with
the same immutable caching as other build assets. Do not add a `<link>` to a
font CDN (a third-party request on every page view) or self-hosted font
files in `public/` (served with `max-age=0`, see the static-art section
above). Licensed or branded font files that must not be fetched from a
public provider go through `fontProviders.local()`.

The wiring has four parts that must match:

- The `fonts` entry names the family, weights, styles, subsets, and
  fallbacks. Subsets follow the project's locale set: `latin` covers the
  starter's German and English. A locale that needs more glyphs adds its
  subset.
- The entry's `cssVariable` is `--font-inter`. `web/src/styles/tokens.css`
  maps `--font-sans` to it. The generated variable already carries the
  configured fallbacks plus Astro's metric-adjusted one.
- The shared layout renders `<Font cssVariable="..." preload={[...]}>` in its
  head. Preload covers the latin upright style. The italic style loads lazily.
  A page that renders its own `<html>` instead of the shared layout (the
  404/500 CMS-down fallbacks) needs its own `<Font>` tags or deliberately
  stays on system fonts. Find such pages with `rg -l "<html" web/src`.
- The web Dockerfile asserts after the build that WOFF2 files were emitted.
  A provider metadata failure does not fail the build, so without the
  assert a fontless image would go unnoticed. Keep the assert when
  changing fonts.

## CMS calls go through the SDK layer

The Astro side talks to Payload through `web/src/cms/`. Route files do
not call `fetch` against the CMS directly. Going through the SDK
preserves the cache behaviour: LRU in prod for reads that opt in, bypass
in dev, in preview, and on live routes that pass `cacheHeader(false)`.
When you add a new content read, add it to the SDK first, then call
it from the route.

The CMS half of such a read is a custom endpoint in `cms/src/endpoints/`.
Endpoints register once at config init and Next's dev HMR does not
re-register them, so an endpoint edit is not live until the CMS dev
server restarts. If an edit seems to have no effect, restart before
debugging anything else.

There is one deliberate exception. `web/src/cms/getRedirects.ts` runs
from `astro.config.mjs` at config-evaluation time. At that point
`astro:env` is not yet set up, so it imports `dotenv/config` and
constructs its own `PayloadSDK` from `process.env` instead of going
through the rest of the SDK helpers. Do not add new exceptions without
a similarly hard reason.

## Build-time CMS reads fail a strict build, degrade otherwise

`web/src/cms/getRedirects.ts` runs from `astro.config.mjs`, and its result
is folded into the server manifest. A strict build (`REDIRECTS_STRICT=1`,
which the web `build` script sets) fails when the CMS read fails, so a
broken read stops the deploy instead of publishing a site without
redirects over the last good one. Dev, `astro check`, and a plain `astro build`
fall back to the committed `redirects.fallback.json` (empty by default)
so the run still completes. See
[`maintenance.md`](./maintenance.md) for the retry and fallback policy in
full.

Anything else that reads `process.env` from `astro.config.mjs` needs to
import `dotenv/config` at the top of its module, because Astro loads `.env`
through Vite after the user config has already been evaluated.

## Localized values come from per-locale lookups

Slugs, titles, summaries, and rich text are localized in Payload. Do not
treat the default locale as a fallback you can derive from string
replacement. The pages plugin emits a per-locale `path` field on each
document and the language switcher reads those paths from
`Astro.props.paths`. The seed uses different slugs per locale to test
this. Keep that divergence when you edit seeds.

## Every content page is a Pages document

A page with content lives in the CMS page tree, even when code sets its
layout. Routes written in code are only for pages without editor content. A
page laid out in code is a templated page: a Pages document whose
`template` is not `default`. The page routes render it through its body
component instead of the sections blocks, and the document keeps its title,
path, SEO fields and preview.

Each template has one document. Its template, slug, parent and root state
are fixed: the `beforeValidate` guard in `cms/src/collections/Pages.ts`
rejects a change, editors can create and delete only `default` pages, and
Pages has no duplicate action. To change the slug, edit the
`seedTemplatedPage()` call and run it again. Restoring a version of a
templated page fails: Payload validates a restore against the default
locale only and writes the other locales from the version, which can hold
an older slug.

To add a template:

1. Add its name to `pageTemplates` and its admin labels to
   `pageTemplateLabels` in `cms/src/shared.ts`, then run
   `pnpm --filter @astroload/cms generate:types`.
2. Add a body component under `web/src/layout/routes/` that takes
   `TemplatedBodyProps`, and its entry in the `bodies` map in
   `TemplatedBody.astro`. `astro check` fails while a template has no body.
3. Add one `seedTemplatedPage()` call per locale to `cms/src/seed.ts`, for
   example `seedTemplatedPage(payload, 'landing', 'en', { title: 'Landing', slug: 'landing', parent: homeId, _status: 'published' })`.
   The call finds the document by its template, then updates it or creates
   it. To add the document to an existing database, run the same calls in a
   script under `cms/src/scripts/` (see
   [`content-workflow.md`](./content-workflow.md)).

To turn an existing page into a template, replace its old seed calls with
`seedTemplatedPage()` calls and set its template once in a script:
`payload.update({ collection: 'pages', id, data: { template: 'landing' }, context: { seed: true } })`.
Without that step the seed call finds no document for the template, creates
a second page, and fails on the slug that the old page still holds.

The build fails when a template has no published document with a path in
every locale, or when a document's template changed after `getStaticPaths`
listed it.

Links to paths written in code go through `localePath()` in
`web/src/lib/localePath.ts`, which adds the locale prefix when URLs carry
one. A stored document `path` already carries its prefix and goes into the
link unchanged. `node scripts/locale-prefix.mjs` fails on a doubled prefix
such as `/en/en/` in `web/dist`. CI runs it through `sh scripts/gates.sh dist`
after the end-to-end build.

## Dates and numbers go through `format.ts`

`formatDate()` and `formatNumber()` in `web/src/lib/format.ts` format with
`Intl.DateTimeFormat` and `Intl.NumberFormat`. They take the BCP 47 locale
from `INTL_LOCALE` and the time zone from `TIME_ZONE`, both in
`cms/src/site-config.ts`. Do not call `toLocale*String()` or the `Intl`
formatters directly. `formatDate()` takes no `timeZone` option, so call
`Intl.DateTimeFormat` for a date that needs a zone other than `TIME_ZONE`.
`TIME_ZONE` is `'UTC'`, so a post published at 00:30 Vienna time shows
the previous day. A site whose readers share one zone sets that zone, for
example `'Europe/Vienna'`.

The region in `INTL_LOCALE` changes what visitors see: `de-AT` renders
"Jänner" and "1 234,5", `de-DE` renders "Januar" and "1.234,5". Add an
`INTL_LOCALE` entry with each new locale.

## API keys are server-only

`PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` must not reach the client
bundle. Read them through `astro:env/server`, not `astro:env/client`. This
matters most for the preview key, because a leak exposes the draft state
of Pages, Posts, and Authors.

If you find an island that needs CMS data, fetch the data in the parent
`.astro` file and pass it down as props.

## Client scripts run once per document

The layout renders no `<ClientRouter />`, so every link click loads a new
document and every script runs again from the start. Back and Forward can
restore a page from the back/forward cache instead (see below). A script
binds its handlers when it runs and needs no navigation event.

- `Umami.astro` sends one pageview per document load, after
  `whenActive()` resolves, and one more when the browser restores the page
  from the back/forward cache. To drop hits from a staging host, add
  `data-domains="example.com"` to the tracker tag. The tracker compares
  each host name exactly, so `example.com` does not match
  `www.example.com`.
- `FormBlock.astro` binds every form on the page through `attachAll()`.
- `PreviewNav.astro` binds one click listener to `document`.

A Chromium-based browser can prerender a page through speculation rules
and run its scripts before the visitor opens it
([`document.prerendering`](https://developer.mozilla.org/en-US/docs/Web/API/Document/prerendering)).
Observers, canvas setup and analytics calls start through `whenActive()`
from `web/src/scripts/site.js`. On a prerendered page, `whenActive()` waits
until the visitor opens the page.

A page that the browser restores from the back/forward cache runs no
script again ([bfcache](https://web.dev/articles/bfcache)). A script that
must act on each visit listens for `pageshow` and checks
`event.persisted`. To keep public pages eligible for that cache, add no
`unload` listener, and send `Cache-Control: no-store` only where a response
must not be reused:

- the preview route, so that drafts stay out of caches
- the redirect at the multi-locale root, because its target depends on
  `Accept-Language`
- on-demand routes that render live data (see
  [Render-mode choices live at the top of the file](#render-mode-choices-live-at-the-top-of-the-file))
- private or authenticated routes

With `<ClientRouter />`, the router swaps the page in place. A bundled
script then runs only on the first page, and Astro fires `astro:page-load`
after the first load and after every swap. A project that adds the router
back calls each script's setup from an `astro:page-load` listener:

- `Umami.astro` calls `sendPageview()` from the listener instead of at once.
  On a page without the tracker tag, such as a preview page, it sends
  nothing.
- `FormBlock.astro` calls `attachAll()` from the listener. The
  `data-form-initialized` marker stops a second binding of the same form.
- `PreviewNav.astro` needs no change. The listener on `document` stays in
  place across swaps. On each click it does nothing outside `/preview/`,
  and on a preview page it reads the locale and the secret from the
  current URL.

## A Lexical block and its renderer are added together

The Lexical editor's `BlocksFeature` (`cms/`) lists the block types an editor can
insert. `web/src/components/lexical/BlockRenderer.astro` lists the renderer for
each one. The two lists must match: a block the editor can insert but the web
cannot render throws at render time.

The renderer checks this at build time. It keeps a
`LexicalBlockType` union of the allowed block types and a `renderers` map checked
with `satisfies Record<LexicalBlockType, unknown>`, so adding a type to the union
without a matching renderer fails the build. When you add a block to the editor,
add its type to the union and its component to the map in the same change. The
runtime `throw` still catches a block that reaches the renderer without a
case.

This is the general shape for any producer-consumer pair in the codebase: when
one side gains a case the other must handle, encode the link as a type the
compiler checks, not a comment a reader has to find.

## Accessibility floor

Starter policy, stricter than the WCAG minimum where noted.

- Text color tokens hold a 4.5:1 contrast ratio on every surface they
  appear on, in every color scheme the project supports. That includes
  large text, where WCAG AA asks only 3:1, because one threshold is easier
  to keep correct than two. A color with alpha is composited against each actual
  background before measuring. Check each pair with the DevTools contrast
  inspector, or compute it from the resolved colors. Text that is pure
  decoration (a separator glyph between links) is exempt per WCAG 1.4.3
  and carries `aria-hidden="true"` so screen readers skip it too.
- Interactive targets outside running text get at least 24 by 24 CSS px.
  The starter applies this minimum even where WCAG 2.2 AA (2.5.8) permits
  an exception for inline links, spaced targets, or equivalent controls,
  because one rule is easier to apply than four exceptions. The visual
  size can stay small: a `min-block-size: 1.5rem` and
  `min-inline-size: 1.5rem` box around small text, or
  padding plus `background-clip: content-box` on a drawn control. A label
  that activates its input counts toward that input's target. Worked
  examples: the links in `LanguageSwitcher.astro` and the checkbox label
  in `FormBlock.astro`.
- Every page starts with a skip link: the first focusable element in
  `<body>` links to `main#main`. `main#main` has `tabindex="-1"`, so it
  takes focus. The link shows only when focused. `Layout.astro`,
  `styleguide.astro` and the fallback pages of `404.astro` and
  `500.astro` render the link with `SkipLink.astro` and `main#main` with
  `MainContent.astro`. The link text and the label of the primary `nav`
  in `Header.astro` come from `web/src/layout/shellLabels.ts`, one entry
  per locale. Sources:
  [bypass blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html),
  [landmark regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/).
- One `:focus-visible` rule in `web/src/styles/base.css` draws the focus
  ring on every element that matches `:focus-visible`, `main#main`
  included: a 2px outline in `--color-focus`, 2px outside the element.
  `--color-focus` holds at least 3:1 against `--color-surface` and
  `--color-notice-surface`. A component sets no focus ring of its own
  ([focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)).

Run these checks when changing the palette or adding controls: every text
token and `--color-focus` against every background it appears on, and a
sweep of interactive elements measuring the rendered target box at the
smallest supported viewport.

## A required array with minRows gets a matching defaultValue

An array field with `required: true` and `minRows: 2` rejects a publish
until the array holds two rows. On a collection without drafts, or with
`drafts.validate: true`, it rejects every save until then. Set
`defaultValue` to that many empty rows, so a new document opens with the
rows to fill in:

```ts
{
  name: 'steps',
  type: 'array',
  required: true,
  minRows: 2,
  defaultValue: [{}, {}],
  fields: [{ name: 'text', type: 'text', required: true }],
}
```

In Payload 3.91.0,
[`validateArrayLength`](https://github.com/payloadcms/payload/blob/v3.91.0/packages/payload/src/fields/validations.ts#L444-L474)
rejects 0 to `minRows - 1` rows on a required array. On an optional array
it accepts 0 rows and rejects 1 to `minRows - 1`, so an optional array
needs no `defaultValue`.

A `hasMany` relationship, such as `authors` on Posts, cannot hold an empty
row, so it gets no `defaultValue`. The
[`relationship` validator](https://github.com/payloadcms/payload/blob/v3.91.0/packages/payload/src/fields/validations.ts#L884-L908)
rejects an empty list when the field is `required`. It checks `minRows`
only when the list holds values.

## Structured data names only what the page shows

`web/src/components/JsonLd.astro` emits one schema.org graph per page.
Google's guidelines ask that structured data describe content visible on
the page
([guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)),
so the component marks up only content the starter shows, plus URLs, the
logo and the date of the last change of a post:

- Home page: `WebSite`, and `Organization` with name, url and logo (the
  default SEO image of the site settings).
- Post: `Article` with headline, excerpt, publication date, date of the
  last change (`updatedAt`), author names and author page URLs, the cover
  image, and the organization as publisher.
- Author page: `ProfilePage` whose `mainEntity` is a `Person` with name,
  url, photo and role.
- Other pages: `WebPage`.

`web/src/cms/structuredData.ts` holds a builder per type. Each builder takes
plain inputs and emits a property only when its input is set. Before a
project passes more inputs to a builder, it shows that data on the page:

| Builder | Show first |
|---|---|
| `organizationLd`: `legalName`, `vatID`, `foundingDate`, `address`, `contactPoint`, `sameAs`, `subOrganization` | the values, for example in the footer or on the imprint page, from new site settings fields |
| `localBusinessLd` | address, telephone and opening hours, plus a field for the subtype. A page that passes `geo` shows the address. A page that passes `parentOrganization` shows the parent's name |
| `personLd`: `sameAs`, `worksFor`, `description` | profile links, the employer, and a plain text version of the bio for `description` |
| `articleLd`: `dateModified` | nothing. It is the one exception: Google's [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article) recommends `dateModified`, and the post page does not need to show it |
| `articleLd`: more images | Google asks for 16:9, 4:3 and 1:1 crops of at least 50,000 pixels each. Media makes one 1200 by 630 `og` crop. Add `imageSizes` entries in `cms/src/collections/Media.ts`. Existing uploads get the new crops only when their file is uploaded again, or cropped, resized or given a new focal point in the admin image editor |
| `breadcrumbListLd` | a breadcrumb trail with a URL on every item except the current page, for example from the `breadcrumbs` field of the pages plugin |
| `jobPostingLd` | title, description as HTML, date posted, employer and a location with a country, from a job collection |
| `eventLd` | name, start date with a time zone offset, venue name and address, from an event collection |

A project that uses `localBusinessLd` logs `localBusinessWarnings` at
build time. Test each type a project adds with the
[Rich Results test](https://search.google.com/test/rich-results).

## Generated files

`cms/src/payload-types.ts` is regenerated by Payload. It is checked in so
that downstream type imports work without a build step. Do not edit it. Run the type generator (`pnpm --filter @astroload/cms generate:types`)
after collection changes.

## Installing dependencies

Install dependencies with `pnpm install --frozen-lockfile`. pnpm 10 runs the
build scripts of dependencies only for the packages in `onlyBuiltDependencies`
in the root `package.json`, so no install needs `--ignore-scripts` or a
`pnpm rebuild <pkg>` step. `packageManager` pins pnpm 10.24.0. Do not raise
the major version. Before a new package goes in, check with
`pnpm view <pkg> time` that its version is at least 7 days old, and check that
it keeps the provenance of its earlier versions.

## Lints and checks before opening a PR

Run `git config core.hooksPath` once per clone. If it prints nothing, run
`pnpm run setup`, which sets `core.hooksPath` to `.githooks`. If it prints
another folder, add the checks from `.githooks/pre-commit` and
`.githooks/commit-msg` to the hooks in that folder. The `pre-commit` hook runs
Prettier, ESLint and Stylelint on the staged files, then
`sh scripts/gates.sh source` over all of `web/src`. The tools read the working
tree copy, so a partially staged file is checked with its unstaged changes.
The gates script needs ripgrep (`rg`). The `commit-msg` hook accepts
`type(scope)!: subject` with an optional lower-case scope and `!`. It rejects
a type other than `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `ci` or
`test`, a subject that starts with an upper-case letter or white space, more
than 72 characters, or a trailing full stop. Merge, revert and reapply
subjects in the Git formats that the hook lists also pass. The hook reads only
the subject. Add a body only when the subject cannot carry the reason for the
change.

Run `pnpm verify` before opening a PR. It runs `pnpm lint`, `pnpm check` and
`pnpm test`, regenerates the types and the import map and fails if
`payload-types.ts` or `importMap.js` changed, then runs `pnpm knip`,
`sh scripts/gates.sh source`, the web build and `sh scripts/gates.sh dist`.
The web build reads the redirects from the CMS,
so `verify` needs the CMS running at the `CMS_URL` in `web/.env`. The
end-to-end suite is a separate command (see
[End-to-end tests](#end-to-end-tests)). The CI workflow
(`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm check` and `pnpm test` on
every push to `main` and every pull request. Two more steps regenerate the
types and the import map and fail if a committed file is out of date. The
import map step runs a second time with the S3 variables set, which `verify`
does not repeat. The `e2e` job builds the web app, runs the end-to-end suite and then
`sh scripts/gates.sh dist`. `pnpm check`
typechecks both workspaces (`tsc --noEmit` in the CMS, `astro check` in the
web app). `pnpm lint` runs ESLint in both workspaces, then `prettier --check .`
on the whole repository, then Stylelint on the CSS and `.astro` files in
`web/src`. `pnpm exec prettier --write .` fixes the Prettier findings, and
`pnpm exec stylelint "web/src/**/*.{css,astro}" --fix` fixes most Stylelint
findings. `.prettierignore` lists the files Prettier skips. The web ESLint
config (`web/eslint.config.js`) runs the recommended rules of ESLint and
`typescript-eslint`, and the Astro and accessibility rules of
`eslint-plugin-astro`. It runs no rules that need type information.
`astro check` reports type errors.

The test runner is Vitest in both workspaces. The root `pnpm test` runs
the web tests, the CMS tests and then the Node-based tests in
`scripts/*.test.mjs`. The web tests cover pure units such as URL
building and the stale-on-error wrapper. `web/vitest.config.ts` builds
its config with `getViteConfig()` from `astro/config`, so a web test can
render an `.astro` component with the container API. With
`{ configFile: false }`, the tests skip `astro.config.mjs`, render with
Astro's defaults and do not fetch redirects from the CMS. The CMS tests
cover `triggerDeployAfterChange` (the draft check, publish and unpublish)
and the templated page guards and access rules in Pages.
`cms/src/env.ts` reads the environment once at import, so a CMS test
stubs `process.env` with `vi.stubEnv` and then imports the module under
test after `vi.resetModules()`. The end-to-end suite below covers draft
leakage for top-level fields and the form submission path. Draft leakage
through populated relationships has no test yet. See
[`security.md`](./security.md).

## End-to-end tests

`web/e2e/` holds a Playwright suite for the contracts these docs state. It
covers the API key and draft rules from [`security.md`](./security.md) and
the form path from [`forms.md`](./forms.md). It also covers the preview
route, media variants, routing, sitemaps, redirects, the deploy webhook and
the analytics relay. Add a test only for a contract these docs state.
Check behavior that matters for one release only by hand during that
upgrade.

The suite needs a seeded Mongo. It starts the CMS and the web app itself.
Before you run `pnpm --filter @astroload/web test:e2e`, set up the
following:

- Mongo runs at `DATABASE_URI` from `cms/.env` and holds the demo content
  (`pnpm --filter @astroload/cms seed`). The suite logs in as the seeded
  admin: `PAYLOAD_ADMIN_EMAIL` and `PAYLOAD_ADMIN_PASSWORD` from `cms/.env`,
  or `admin@example.com` / `admin1234` when they are unset. It uses the demo
  pages and the Contact form. Every test deletes the documents it creates.
  The live preview test turns on the admin's live preview for Pages and
  restores the previous setting afterwards.
- `web/.env` holds `PAYLOAD_READ_KEY`, `PAYLOAD_PREVIEW_KEY` and
  `PREVIEW_SECRET`. `cms/.env` holds the same `PREVIEW_SECRET`.
- `CMS_URL` in `web/.env` has the same value as `SERVER_URL` in
  `cms/.env`. The suite starts the CMS dev server on the port of `CMS_URL`.
  Then it builds the web app and starts it with the values from `web/.env`
  on the port of `WEBSITE_URL`. When `CI` is unset, the suite uses a CMS or
  web app that already answers at its URL. Stop a web app that runs a build
  from before your last content or env change.
- Chromium is installed once with
  `pnpm --filter @astroload/web exec playwright install chromium`. If
  Playwright does not support your Linux release yet, prefix the command
  with `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` or another
  supported platform.

Three spec files need setup that the CMS or the web app reads at start, or
that the web build bakes in:

- Deploy webhook: `DEPLOY_HOOK_URL=http://127.0.0.1:4322/deploy` in
  `cms/.env`. The test listens on that port. It skips when the value is
  unset or is not a loopback `http` URL with a port. The CMS sends the
  webhook at once only when no five-minute window is open, and it holds
  later saves until the window closes (see
  [`maintenance.md`](./maintenance.md)). The test passes only when the
  webhook did not fire in the five minutes before the run. The suite's own
  later saves keep a window open. Before a rerun, restart a CMS that the
  suite did not start.
- Analytics relay: `UMAMI_WEBSITE_ID=<any value>` and
  `UMAMI_HOST_URL=http://127.0.0.1:4322` in `web/.env`. With the id set,
  the suite runs the relay test, a pageview test and a preview secret
  test. The pageview test serves a stand-in tracker and checks for one
  pageview per document load, none while a page is prerendered, and one
  more on a `pageshow` event with `persisted` set. The preview secret test
  checks that the secret reaches neither a pageview payload nor a
  referrer. Without the id, the suite checks
  that `POST /api/send` answers 204 instead.
- Redirects: at least one Redirects document before the build. The demo
  seed creates one. The test reads the Redirects documents from the CMS and
  expects the built web app to answer each one. Rebuild after you add or
  change one. Without any Redirects document the test skips.

The routing test checks the `content-build-id` meta tag on `/en`. It
expects the tag when `CONTENT_BUILD_ID` was set in `web/.env` before the
build, and no tag otherwise. Rebuild after changing it.

Spec files end in `.e2e.ts`, so vitest does not collect them. They run one
at a time in name order because they share one CMS. The `00-` prefix runs
`00-deploy-hook.e2e.ts` before any other test publishes. Before any server
starts, a check stops the run with one message when a key is missing or
`PREVIEW_SECRET` differs between the two env files. A failed test leaves a
trace under `web/.playwright/results/`. Every run writes an HTML report to
`web/.playwright/report/`. Git ignores both.

The `e2e` job in `.github/workflows/ci.yml` runs the suite against a
`mongo:8` service. It appends fixed test values to copies of both
`.env.example` files, so it needs no repository secret. The values set up
the deploy webhook and analytics relay tests, and the seed creates the
Redirects document, so only the 204 test in `umami.e2e.ts` skips. When a
step fails, the job uploads `web/.playwright/` as the `playwright`
artifact.

`styleguide.e2e.ts` runs axe on `/styleguide` with the `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` tags and fails on any
violation.
