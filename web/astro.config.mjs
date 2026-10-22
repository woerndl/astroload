// @ts-check
import 'dotenv/config'
import node from '@astrojs/node'
import { defineConfig, envField, fontProviders } from 'astro/config'

import { getRedirects } from './src/cms/getRedirects'
import { LOCALE_URL_PREFIX } from './src/cms/types'

// Astro reads a route's render mode with a regex over the file source
// (PRERENDER_REGEX in astro/dist/core/routing/prerender.js), so only a
// literal `export const prerender = true` or `= false` counts and a computed
// export is silently ignored. Route files keep literal exports, and the
// conditional cases are decided here in the `astro:route:setup` hook.
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
      // their prerendered patterns still register, and @astrojs/node before
      // 11.1.2 answered them with a 500. Rendering them on demand lets each
      // route's own locale guard return the 404. The [lang] sitemap endpoint
      // sets `prerender = false` in its route file for the same reason.
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
  // Astro inlines a stylesheet under 4 kB by default. The honeypot rule in
  // src/styles/styles.css must stay in an external file (see
  // docs/astroload/forms.md).
  build: { inlineStylesheets: 'never' },
  // Nothing uses Astro.session. Opting out drops the session runtime and
  // unstorage from the server bundle.
  session: false,
  security: {
    // Astro.url takes its host from Host or x-forwarded-host only for a host
    // in this list, and localhost:<port> for any other. See
    // docs/astroload/deployment.md.
    allowedDomains: process.env.WEBSITE_URL
      ? [{ hostname: new URL(process.env.WEBSITE_URL).hostname }]
      : [],
    // The hash matches the inline layer statement in src/components/LayerOrder.astro.
    // 'unsafe-inline' covers the style attributes that the Lexical renderer
    // and FormBlock.astro write. Leave csp off with <ClientRouter />. Read
    // docs/astroload/security.md first.
    // csp: {
    //   styleDirective: {
    //     resources: [{ resource: "'unsafe-inline'", kind: 'attribute' }],
    //     hashes: ['sha256-UCw/CCY1woWnHLXw1DWmEk/xd8g3e2X8KaXDVdnsOdU='],
    //   },
    // },
  },
  redirects: await getRedirects(),
  image: { responsiveStyles: true, layout: 'constrained' },
  // Fetched at build time and served first-party under /_astro/fonts/, so no
  // visitor traffic goes to Google. src/styles/tokens.css maps --font-sans to
  // --font-inter. Set the subsets to cover the project's locales. See
  // docs/astroload/conventions.md.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['400 700'],
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
  ],
  // Pinned dev port. Renumber per project. strictPort only takes effect under
  // vite.server, and it makes a second dev server fail to start instead of
  // moving to the next free port while a stale process answers this one.
  server: { port: 4321 },
  vite: {
    server: { strictPort: true },
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
      // When set, every page loads the tracker through the first-party proxy
      // routes (see src/components/Umami.astro).
      UMAMI_WEBSITE_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      // Origin the proxy routes fetch the tracker from and forward events to,
      // for example a self-hosted Umami. Secret access makes Astro read it at
      // run time, because public server variables are inlined at build time.
      UMAMI_HOST_URL: envField.string({
        context: 'server',
        access: 'secret',
        default: 'https://cloud.umami.is',
      }),
      // Written into every page the shared layout renders as
      // <meta name="content-build-id">. A value that changes per deploy makes a
      // rebuild of the same commit produce different output once the host
      // includes it in its build cache key or build caching is off. See
      // maintenance.md for the setup per host.
      CONTENT_BUILD_ID: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },
})
