# astroload agent guidance

## No banner-style separator comments

No `# --- Section ---` or `// ===== Section =====`. A plain one-line
comment is fine when a group of lines needs a header.

## Project docs

Read the matching file before working on the listed topics.

- [`docs/astroload/architecture.md`](./docs/astroload/architecture.md): service boundaries, decoupling, locales, preview gate, rich text
- [`docs/astroload/conventions.md`](./docs/astroload/conventions.md): prerender shapes, new routes, SDK layer, server-only keys, collection changes, generated types, localized values
- [`docs/astroload/forms.md`](./docs/astroload/forms.md): field renderer, cross-origin POST, spam guard, JS-required submission, accessibility
- [`docs/astroload/content-workflow.md`](./docs/astroload/content-workflow.md): changing content, the scratch-script lane, MCP and REST paths, local-vs-deployed targets
- [`docs/astroload/deployment.md`](./docs/astroload/deployment.md): Docker images, standalone output, media volume, production compose, baked build env
- [`docs/astroload/maintenance.md`](./docs/astroload/maintenance.md): global schema changes, default locale, new locale, deploy throttle, redirects at config-eval, lexical link slip, lexical blocks, seed
- [`docs/astroload/security.md`](./docs/astroload/security.md): threat model, draft leakage, preview route, cross-origin posture, rate limiting, hardening
