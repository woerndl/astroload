# astroload agent guidance

## No banner-style separator comments

No `# --- Section ---` or `// ===== Section =====`. A plain one-line
comment is fine when a group of lines needs a header.

## Project docs

Read the matching file before working on the listed topics.

- [`docs/architecture.md`](./docs/architecture.md) — service boundaries, decoupling, locales, preview gate, rich text
- [`docs/conventions.md`](./docs/conventions.md) — prerender shapes, new routes, SDK layer, server-only keys, collection changes, generated types, localized values
- [`docs/forms.md`](./docs/forms.md) — field renderer, cross-origin POST, spam guard, JS-required submission, accessibility
- [`docs/maintenance.md`](./docs/maintenance.md) — global schema changes, default locale, new locale, deploy throttle, redirects at config-eval, lexical link slip, lexical blocks, seed
- [`docs/security.md`](./docs/security.md) — threat model, draft leakage, preview route, cross-origin posture, rate limiting, hardening
