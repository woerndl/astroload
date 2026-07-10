# Conventions

Rules that hold across the codebase. If you are an LLM agent, treat these
as constraints, not suggestions. If you are a human contributor, the same
applies but you also get to push back on anything that has stopped making
sense.

## Comments stand on their own

Code comments and commit messages must not reference internal plans,
issue numbers, or any docs that may not be in the repo. If a rule
matters at a callsite, inline the rule. Stable upstream URLs and
committed top-level files are fine to cite. Comments outlive the docs
they reference, so "see internal note X" rots the moment that note is
renamed or moved.

## No AI slop in repo-tracked text

Applies to code comments, commit messages, README, error messages, and any
public-facing prose. Worst offenders to actively police: em dashes,
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
  The content catch-alls, the home page, the sitemap index, and
  `robots.txt` use this.
- `export const prerender = false` for routes that must run per request.
  The 404 and 500 pages, the per-locale sitemap (a prerendered dynamic
  endpoint would answer unknown locales with a 500 instead of a 404), and
  anything under `/preview` are in this group.

Every conditional case lives in the `prerenderOverrides` integration in
`astro.config.mjs`, the seam Astro provides for per-route overrides. It
renders everything on demand in dev (so admin edits show up without a
restart), the `[lang]` routes on demand in a single-locale build, and
the root on demand in a multi-locale build (the Accept-Language
redirect needs the request). If a new route needs a conditional render
mode, extend that integration rather than computing the export.

A small subset of the second shape is the on-demand opt-in: a public route
that must reflect the latest content without waiting for a rebuild (a live
listing, a dashboard). It uses the same `prerender = false`, wraps its CMS
read in the `staleOnError` helper (`web/src/cms/staleOnError.ts`), and sets
`Cache-Control: no-store`. The helper serves the last good response when the
CMS read fails, so an outage degrades that one route instead of failing it,
and logs the swallowed error so the failing read stays visible. On a cold
start with nothing cached the error still propagates, so the route shows its
normal error page rather than a blank success.
`web/src/pages/latest.astro` is the worked example. Keep this set small.
Static prerendering stays the default for everything else.

If you add a new route, pick the right shape and write it at the top of
the file.

## A pinned dev port needs strictPort under vite.server

Astro's top-level `server` option accepts `port` but ignores keys it does
not know, so `server: { port: 4330, strictPort: true }` pins the port
without the strictness. When the port is taken, the dev server hops to the
next free one and a stale process keeps answering the pinned URL. Put the
flag in Vite's config, which Astro passes through:

```js
server: { port: 4330 },
vite: { server: { strictPort: true } },
```

With `strictPort` in place, a second dev server on the same port refuses
to start instead of auto-incrementing.

## Display-changing state classes use compound selectors

A modifier that flips visibility (`.menu.is-open { display: flex }`) must
be written as a compound selector so it outranks the base rule. Two
single-class rules have equal specificity, and the tie resolves by source
order, which is not stable between the dev server and the production
bundle. A toggle that works in dev can lose the tie after bundling, and
the failure only shows up on the built site.

## CMS calls go through the SDK layer

The Astro side talks to Payload through `web/src/cms/`. Route files do
not call `fetch` against the CMS directly. Going through the SDK
preserves the cache behaviour: LRU in prod, bypass in dev and preview.
When you add a new content read, add it to the SDK first, then call
it from the route.

There is one deliberate exception. `web/src/cms/getRedirects.ts` runs
from `astro.config.mjs` at config-evaluation time. At that point
`astro:env` is not yet wired, so it imports `dotenv/config` and
constructs its own `PayloadSDK` from `process.env` instead of going
through the rest of the SDK helpers. Do not add new exceptions without
a similarly hard reason.

## Build-time CMS reads fail loud on a strict build, degrade otherwise

`web/src/cms/getRedirects.ts` runs from `astro.config.mjs`, and its result
is folded into the server manifest. A strict build (`REDIRECTS_STRICT=1`,
which the web `build` script sets) fails when the CMS read fails, so a
deploy never ships a redirect-less site over the last good one. Dev,
`astro check`, and a plain `astro build` fall back to the committed
`redirects.fallback.json` (empty by default) so the run still ships. See
[`maintenance.md`](./maintenance.md) for the retry, fail-loud, and fallback
policy in full.

Anything else that reads `process.env` from `astro.config.mjs` needs to
import `dotenv/config` at the top of its module, because Astro loads `.env`
through Vite after the user config has already been evaluated.

## Localized values come from per-locale lookups

Slugs, titles, summaries, and rich text are localized in Payload. Do not
treat the default locale as a fallback you can derive from string
replacement. The pages plugin emits a per-locale `path` field on each
document and the language switcher reads those paths from
`Astro.props.paths`. The seed deliberately uses different slugs per
locale to prove this works. Keep that divergence when you edit seeds.

## API keys are server-only

`PAYLOAD_READ_KEY` and `PAYLOAD_PREVIEW_KEY` must never reach the client
bundle. Read them through `astro:env/server`, not `astro:env/client`. The
preview key in particular is gated this way because a leak exposes the
draft state of every published collection. The read key is server-only too
so that the API token does not become a client-enumerable secret.

If you find an island that needs CMS data, fetch the data in the parent
`.astro` file and pass it down as props.

## Client scripts re-arm after view-transition swaps and stay idempotent

The layout renders `<ClientRouter />`, so navigation swaps the `<body>` in place
instead of reloading the document. An inline script that wires up a specific
element only runs on the first load, so its handlers are lost when that element
is swapped in again. Such a script must re-attach on the `astro:after-swap`
event and must guard against binding twice, because the event also fires on the
page where the script first ran.

`web/src/components/blocks/FormBlock.astro` is the worked example. It exposes an
`attachAll()` that marks each form with `data-form-initialized` before binding,
skips any form already marked, and runs both on load and on `astro:after-swap`.
A listener bound to a node that survives swaps (`document`, `window`) needs the
idempotency guard but not the re-arm, since the node is never replaced.
`web/src/components/PreviewNav.astro` is that variant, attached once to
`document` behind a `window` flag.

## A Lexical block and its renderer are added together

The Lexical editor's `BlocksFeature` (`cms/`) lists the block types an editor can
insert. `web/src/components/lexical/BlockRenderer.astro` lists the renderer for
each one. The two must stay in step: a block the editor can insert but the web
cannot render throws at render time.

The renderer enforces this so the coupling cannot drift silently. It keeps a
`LexicalBlockType` union of the allowed block types and a `renderers` map checked
with `satisfies Record<LexicalBlockType, unknown>`, so adding a type to the union
without a matching renderer fails the build. When you add a block to the editor,
add its type to the union and its component to the map in the same change. The
runtime `throw` stays as the backstop for a block that reaches the renderer
without a case.

This is the general shape for any producer-consumer pair in the codebase: when
one side gains a case the other must handle, encode the link as a type the
compiler checks, not a comment a reader has to find.

## Generated files

`cms/src/payload-types.ts` is regenerated by Payload. It is checked in so
that downstream type imports work without a build step, but you should
not edit it. Run the type generator (`pnpm --filter cms generate:types`)
after collection changes.

## Lints and checks before opening a PR

Run `pnpm lint`, `pnpm check`, and `pnpm test` before opening a PR. The CI
workflow (`.github/workflows/ci.yml`) runs the same three commands on every push
to `main` and every pull request, plus a step that regenerates the types and
fails if the committed `payload-types.ts` is out of date. `pnpm check`
typechecks both workspaces (`tsc --noEmit` in the CMS, `astro check` in the
web app). `pnpm lint` covers the CMS only, since the web workspace has no
linter configured.

The test runner is Vitest in the web workspace (`pnpm test` runs `vitest run`).
It covers pure units such as URL building and the stale-on-error wrapper. The
CMS workspace has no test runner, so a CMS-side hook ships with the same
inline-reasoning comments that `spamGuard` and `validateSubmission` carry rather
than a unit test. Two larger integration slots stay open and are called out in
[`security.md`](./security.md) and [`forms.md`](./forms.md): a draft-leakage
regression test and a form-submission integration test.
