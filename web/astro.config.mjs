// @ts-check
import 'dotenv/config'
import { existsSync } from 'node:fs'

import node from '@astrojs/node'
import { defineConfig, envField, fontProviders } from 'astro/config'

import { getRedirects } from './src/cms/getRedirects'
import { LOCALE_URL_PREFIX, LOCALES } from './src/cms/types'

// Astro reads a route's render mode with a regex over the file source
// (PRERENDER_REGEX in astro/dist/core/routing/prerender.js), so only a
// literal `export const prerender = true` or `= false` counts and a computed
// export is silently ignored. Route files keep literal exports, and the
// conditional cases are decided here in the `astro:route:setup` hook.
let devServer = false
/** @type {import('./src/cms/types').Locale[]} */
let homeLocales = []

async function getBuiltHomeLocales() {
  const response = await fetch(new URL('/api/static-paths', process.env.CMS_URL), {
    headers: { Authorization: `api-keys API-Key ${process.env.PAYLOAD_READ_KEY}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`static-paths answered ${response.status}`)
  /** @type {import('./src/cms/getStaticPaths').StaticPathItem[]} */
  const items = await response.json()
  return LOCALES.filter((locale) => items.some((item) => item.paths[locale] === `/${locale}`))
}

/** @type {import('astro').AstroIntegration} */
const prerenderOverrides = {
  name: 'prerender-overrides',
  hooks: {
    'astro:config:setup': async ({ command, updateConfig }) => {
      devServer = command === 'dev'
      // The on-demand root redirect reads this list, so it needs no CMS
      // request.
      if (command === 'build' && LOCALE_URL_PREFIX) {
        homeLocales = await getBuiltHomeLocales()
        if (homeLocales.length === 0) throw new Error('the CMS lists no published home page')
        const define = { 'import.meta.env.HOME_LOCALES': JSON.stringify(homeLocales) }
        updateConfig({ vite: { define } })
      }
    },
    'astro:build:done': ({ dir }) => {
      const missing = homeLocales.filter(
        (locale) => !existsSync(new URL(`${locale}/index.html`, dir)),
      )
      if (missing.length > 0) {
        throw new Error(`the root redirect lists homes the build did not prerender: ${missing}`)
      }
    },
    'astro:route:setup': ({ route }) => {
      // Dev renders every route on demand, so content edits in the admin show
      // up without a restart and nothing reads a cached getStaticPaths snapshot.
      if (devServer) {
        route.prerender = false
        return
      }
      // In a single-locale project the [lang] routes have no static paths.
      // Rendering them on demand lets each route's locale guard answer 404. The
      // [lang] sitemap endpoint sets prerender = false for the same reason.
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
  // /api/send is the only route that reads a body, and an Umami event is under 2 KB.
  adapter: node({ mode: 'standalone', bodySizeLimit: 8 * 1024 }),
  integrations: [prerenderOverrides],
  prerenderConflictBehavior: 'error',
  // Astro 7 defaults compressHTML to 'jsx', which collapses whitespace between
  // elements.
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
    // Hosts Astro.url may take from the request. See docs/astroload/deployment.md.
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
  // visitor traffic goes to Google. Set the subsets to cover the project's
  // locales. See
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
  // Renumber per project. strictPort takes effect only under vite.server.
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
      // Rendered as <meta name="content-build-id"> on every page of the shared
      // layout. See docs/astroload/maintenance.md.
      CONTENT_BUILD_ID: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },
})
