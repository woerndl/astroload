# astroload

Astro 6 + Payload 3 + Postgres starter.

## Stack

- Frontend: Astro 6
- CMS: Payload 3 (`@payloadcms/db-postgres`)
- Database: Postgres (local via `docker-compose`)

## Layout

```
.
├── cms/                  Payload application (admin + REST/GraphQL)
├── web/                  Astro frontend (public site + /preview)
├── docker-compose.yml    Postgres for local development
└── pnpm-workspace.yaml
```

## Prerequisites

- Node `22.12+` (pinned in `.nvmrc`)
- pnpm `9+` (workspaces)
- Docker (for local Postgres)

## Quickstart

```bash
pnpm install
docker compose up -d
pnpm --filter @astroload/cms dev    # http://localhost:3000/admin
pnpm --filter @astroload/web dev    # http://localhost:4321
```
