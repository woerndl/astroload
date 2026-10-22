# syntax=docker/dockerfile:1

# Build from the repo root so the pnpm workspace is in context:
#   docker build -f web/Dockerfile -t astroload-web \
#     --build-arg CMS_URL=https://cms.example.com \
#     --build-arg WEBSITE_URL=https://www.example.com \
#     --build-arg PAYLOAD_READ_KEY=<read api key> .
#
# The site is built into the image: astro build prerenders every page from CMS
# content and bakes the public env values in. The CMS must be reachable at
# CMS_URL during the build. CMS_URL, WEBSITE_URL, and PAYLOAD_READ_KEY carry
# production values, and the two preview args below default to placeholders.
# A content publish therefore means rebuilding this image.
# Keep the tag in step with .nvmrc.
FROM node:22.23.4-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY cms/package.json cms/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter @astroload/web...

# The cms sources are needed because the web app imports its generated types
# and shared runtime modules (site config, locale helpers).
COPY cms/ cms/
COPY web/ web/

ARG CMS_URL
ARG WEBSITE_URL
ARG UMAMI_WEBSITE_ID
ARG CONTENT_BUILD_ID
# Plain build args instead of a BuildKit secret, so builders without secret
# support work. PAYLOAD_READ_KEY needs its real value because the build
# fetches the prerendered content with it. PAYLOAD_PREVIEW_KEY and
# PREVIEW_SECRET only have to exist, because astro:env checks them when the
# prerender imports the preview SDK. The placeholder defaults keep their real
# values out of the image, and the runtime env supplies them.
ARG PAYLOAD_READ_KEY
ARG PAYLOAD_PREVIEW_KEY=build-placeholder
ARG PREVIEW_SECRET=build-placeholder
RUN pnpm --filter @astroload/web build

# A failed font provider request leaves the fonts directory empty without
# failing the build, so check for the files here.
RUN test -n "$(ls web/dist/client/_astro/fonts/*.woff2 2>/dev/null)"

# The runtime stage copies node_modules below, so drop devDependencies first.
# CI=true answers the remove-and-reinstall prompt pnpm raises without a TTY.
RUN CI=true pnpm install --frozen-lockfile --prod --filter @astroload/web...

FROM node:22.23.4-alpine AS run
WORKDIR /app
# server.mjs reads CMS_URL at start for the frame-ancestors header.
ARG CMS_URL
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 CMS_URL=$CMS_URL

# The dist references packages through pnpm's symlinks, so both node_modules
# trees come along. PAYLOAD_READ_KEY, PAYLOAD_PREVIEW_KEY, and PREVIEW_SECRET
# are runtime env for the preview route and any route rendered on demand.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/web/node_modules ./web/node_modules
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/web/server.mjs /app/web/aliasRedirect.mjs /app/web/frameAncestors.mjs ./web/

USER node
EXPOSE 4321
CMD ["node", "web/server.mjs"]
