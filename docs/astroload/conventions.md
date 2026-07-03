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

Every Astro route in the template uses one of two prerender shapes:

- `export const prerender = !import.meta.env.DEV;` for routes that should
  be SSR in dev (for instant feedback) and SSG in prod. The localized
  content catch-all, the sitemaps, and `robots.txt` use this.
- `export const prerender = false;` for routes that must run per request.
  The root redirect, the 404 and 500 pages, and anything under
  `/preview` are in this group.

A small subset of the second shape is the on-demand opt-in: a public route
that must reflect the latest content without waiting for a rebuild (a live
listing, a dashboard). It uses the same `prerender = false`, wraps its CMS
read in the `staleOnError` helper (`web/src/cms/staleOnError.ts`), and sets
`Cache-Control: no-store`. The helper serves the last good response when the
CMS is unreachable, so a CMS outage degrades that one route instead of
failing it. On a cold start with nothing cached the error still propagates,
so the route shows its normal error page rather than a blank success.
`web/src/pages/latest.astro` is the worked example. Keep this set small;
static prerendering stays the default for everything else.

Astro also supports `export const prerender = true;` for routes that
should be static even in dev. The template does not currently use it
because every prerendered route here reads from the CMS, and forcing
static in dev would mean the dev server cannot show edits without a
restart. If you add a route whose output never depends on the CMS,
that shape is the right one for it.

If you add a new route, pick the right shape and write it at the top of
the file.

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

`web/src/cms/getRedirects.ts` runs from `astro.config.mjs`. The result
is folded into the server manifest. On a strict build (`REDIRECTS_STRICT=1`,
which the web `build` script sets), a failed CMS fetch is retried with backoff
and, if the CMS stays unreachable, throws, so the deploy fails rather than
shipping a redirect-less site over the last good deploy. A missing env var
throws the same way. In dev, `astro check`, or a plain `astro build`, the
fetch makes one attempt and then returns the committed
`redirects.fallback.json` (empty by default) so the run still ships. Anything
else that reads `process.env` from
`astro.config.mjs` needs to import `dotenv/config` at the top of its
module, because Astro loads `.env` through Vite after the user config
has already been evaluated. See [`maintenance.md`](./maintenance.md)
for the failure mode this prevents.

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

## Generated files

`cms/src/payload-types.ts` is regenerated by Payload. It is checked in so
that downstream type imports work without a build step, but you should
not edit it. Run the type generator (`pnpm --filter cms generate:types`)
after collection changes.

## Lints and checks before opening a PR

Run `pnpm lint` and `pnpm check` before opening a PR. The CI workflow
(`.github/workflows/ci.yml`) runs the same two commands on every push to
`main` and every pull request, plus a step that regenerates the types and
fails if the committed `payload-types.ts` is out of date.

There is no test runner in v1. The repo has slots for a draft-leakage
regression test and a form-submission integration test, both called
out in [`security.md`](./security.md) and [`forms.md`](./forms.md).
