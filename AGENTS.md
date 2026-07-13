# astroload agent guidance

## Upgrade notes in the changelog

A change that needs more from a derived project than applying the diff
gets a nested `**Upgrade notes:**` bullet under its `CHANGELOG.md`
entry, same commit. Cases: bug fix that may also exist in project-added
code (name the search), validation existing data may fail (name the
query to run first), applies only under some project configs (say which
skip it), behavior change a live site may rely on (say what to compare
before and after). Exact command or query when practical, never a
verdict.

## No banner-style separator comments

No `# --- Section ---` / `// ===== Section =====`. Plain one-line
header comment is fine.

## Project docs

Read the matching doc in `docs/astroload/` before working on its topics:

- architecture.md: service boundaries, decoupling, locales, preview gate, rich text
- conventions.md: prerender shapes, new routes, SDK layer, server-only keys, collection changes, generated types, localized values
- forms.md: field renderer, cross-origin POST, spam guard, JS-required submission, accessibility
- content-workflow.md: changing content, scratch-script lane, MCP and REST paths, local-vs-deployed targets
- deployment.md: Docker images, standalone output, media volume, production compose, baked build env
- maintenance.md: global schema changes, default locale, new locale, deploy throttle, redirects at config-eval, lexical link slip, lexical blocks, seed
- security.md: threat model, draft leakage, preview route, cross-origin posture, rate limiting, hardening
- updating.md: syncing a derived project, derivation marker, sync-inventory script, classification verdicts, when to update the marker
