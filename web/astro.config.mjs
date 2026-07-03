// @ts-check
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, envField } from 'astro/config'

import { getRedirects } from './src/cms/getRedirects'

export default defineConfig({
  adapter: node({ mode: 'standalone' }),
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
      // from disabling build caching); the meta tag makes it observable and gives
      // the build a real consumer. See maintenance.md for the host recipes.
      CONTENT_BUILD_ID: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },
})
