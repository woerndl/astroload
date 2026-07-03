// @ts-check
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, envField } from 'astro/config'

import { getRedirects } from './src/cms/getRedirects'
import { LOCALE_URL_PREFIX } from './src/cms/types'

// Astro reads a route's render mode with a regex over the raw file source
// (PRERENDER_REGEX in astro/dist/core/routing/prerender.js), so only a
// literal `export const prerender = true` or `= false` counts. A computed
// export is silently ignored and the route falls back to the default. Route
// files therefore keep literal exports, and every conditional case is decided
// here, in the `astro:route:setup` hook Astro provides for per-route
// overrides.
let devServer = false

/** @type {import('astro').AstroIntegration} */
const prerenderOverrides = {
  name: 'prerender-overrides',
  hooks: {
    'astro:config:setup': ({ command }) => {
      devServer = command === 'dev'
    },
    'astro:route:setup': ({ route }) => {
      // Dev renders every route on demand, so content edits in the admin show
      // up without a restart and nothing reads a cached getStaticPaths snapshot.
      if (devServer) {
        route.prerender = false
        return
      }
      // In a single-locale project the [lang] routes have no static paths, but
      // their prerendered patterns still register, and the Node adapter answers
      // a pattern with no file with a 500 instead of a 404
      // (/anything/sitemap.xml). Rendering them on demand makes each route's
      // own locale guard reachable, so those URLs 404.
      if (!LOCALE_URL_PREFIX && route.component.includes('/pages/[lang]/')) {
        route.prerender = false
      }
      // The multi-locale root needs the request to negotiate Accept-Language.
      if (LOCALE_URL_PREFIX && route.component.endsWith('/pages/index.astro')) {
        route.prerender = false
      }
    },
  },
}

export default defineConfig({
  adapter: node({ mode: 'standalone' }),
  integrations: [prerenderOverrides],
  // Astro 7 defaults compressHTML to 'jsx', which collapses inter-element
  // whitespace. Pin the Astro 6 behavior so templates render unchanged.
  compressHTML: true,
  trailingSlash: 'never',
  redirects: await getRedirects(),
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      PAYLOAD_READ_KEY: envField.string({ context: 'server', access: 'secret' }),
      PAYLOAD_PREVIEW_KEY: envField.string({ context: 'server', access: 'secret' }),
      PREVIEW_SECRET: envField.string({ context: 'server', access: 'secret' }),
      CMS_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:3000',
      }),
      WEBSITE_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:4321',
      }),
      // Umami website id. When set, every page loads the tracker through the
      // first-party proxy routes (see src/components/Umami.astro). Unset ships
      // no analytics at all.
      UMAMI_WEBSITE_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      // Origin the proxy routes fetch the tracker from and forward events to.
      // Point it at a self-hosted Umami instead of Umami Cloud. Runtime env,
      // unlike the baked-in client values above.
      UMAMI_HOST_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'https://cloud.umami.is',
      }),
      // Stamped into every page the shared layout renders as
      // <meta name="content-build-id">. Set it to a
      // value that changes per deploy so a same-commit redeploy (a publish-driven
      // rebuild on the same git SHA) produces different output. The actual cache
      // bust comes from that value being part of the host's build-cache key (or
      // from disabling build caching). The meta tag makes it observable and gives
      // the build a real consumer. See maintenance.md for the host recipes.
      CONTENT_BUILD_ID: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },
})
