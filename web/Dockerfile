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
# production values, the two preview args below default to placeholders.
# A content publish therefore means rebuilding this image.
# Keep the tag in step with .nvmrc.
FROM node:22.22.3-alpine AS build
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
# Declared args instead of a BuildKit secret, so builders without secret
# support work. PAYLOAD_READ_KEY needs its real value: the build fetches the
# prerendered content with it. PAYLOAD_PREVIEW_KEY and PREVIEW_SECRET only
# have to be set, astro:env checks that they exist when the prerender
# imports the preview SDK. Their placeholder defaults keep the real values
# out of the build, the real ones come from the runtime env.
ARG PAYLOAD_READ_KEY
ARG PAYLOAD_PREVIEW_KEY=build-placeholder
ARG PREVIEW_SECRET=build-placeholder
RUN pnpm --filter @astroload/web build

# A font-provider metadata failure does not fail the build, it only leaves
# the fonts directory empty. Fail here instead of deploying without webfonts.
RUN test -n "$(ls web/dist/client/_astro/fonts/*.woff2 2>/dev/null)"

# The runtime stage copies node_modules below, so drop devDependencies first.
# CI=true answers the remove-and-reinstall prompt pnpm raises without a TTY.
RUN CI=true pnpm install --frozen-lockfile --prod --filter @astroload/web...

FROM node:22.22.3-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321

# The dist references packages through pnpm's symlinks, so both node_modules
# trees come along. PAYLOAD_READ_KEY, PAYLOAD_PREVIEW_KEY, and PREVIEW_SECRET
# are runtime env, needed by the preview route and any SSR opt-in.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/web/node_modules ./web/node_modules
COPY --from=build /app/web/dist ./web/dist

USER node
EXPOSE 4321
CMD ["node", "web/dist/server/entry.mjs"]
