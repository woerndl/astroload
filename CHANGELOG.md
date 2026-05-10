# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Added

- pnpm-workspace scaffold with `cms/` (Payload 3.84.1, Postgres via `@payloadcms/db-postgres`) and `web/` (Astro 6.3.1).
- `docker-compose.yml` for local Postgres (dev only).
- Turbopack workspace-root fix in `cms/next.config.ts` so Turbopack resolves `next/package.json` from `cms/src/app` under the pnpm-workspace layout.
- ESLint flat-config for `cms/` using `eslint-config-next` subpath exports.
- CMS auth surface. Users collection with `firstName`, `lastName`, and `roles` (editor and admin, `saveToJWT`). ApiKeys collection with `useAPIKey`, `disableLocalStrategy`, and a `type` discriminator: `read-only` for published-content reads, `preview` for drafts and published reads. Admin-only access on both collections.
- Access helpers under `cms/src/access/`: `isAdmin`, `isAuthenticated`, `isSelfOrAdmin`, `isReadOnlyKey`, `isPreviewKey`. `field/isAdmin` for field-level access.
- Boot-time check at `cms/src/env.ts` that requires `PAYLOAD_SECRET` and `DATABASE_URI`, throwing with a consolidated error if either is missing.
