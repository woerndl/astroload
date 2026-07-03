# syntax=docker/dockerfile:1

# Build from the repo root so the pnpm workspace is in context:
#   docker build -f cms/Dockerfile -t astroload-cms .
# Keep the tag in step with .nvmrc.
FROM node:22.22.3-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cms/package.json cms/
RUN pnpm install --frozen-lockfile --filter @astroload/cms

COPY cms/ cms/
# The build compiles the app and touches neither the database nor real
# secrets. SKIP_ENV_VALIDATION defers the required-vars check to runtime,
# where the real values are injected.
ENV SKIP_ENV_VALIDATION=1
RUN NEXT_OUTPUT=standalone pnpm --filter @astroload/cms build

FROM node:22.22.3-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Uploads land here when S3 is not configured. Mount a volume at this path or
# the files vanish with the container.
ENV MEDIA_DIR=/app/media

# Standalone output mirrors the workspace layout: the server entry is
# cms/server.js and static assets are served from cms/.next/static.
COPY --from=build /app/cms/.next/standalone ./
COPY --from=build /app/cms/.next/static ./cms/.next/static
# The media volume and Next's image cache are the two paths the server writes.
RUN mkdir -p /app/media cms/.next/cache && chown -R node:node /app/media cms/.next/cache

USER node
EXPOSE 3000
CMD ["node", "cms/server.js"]
