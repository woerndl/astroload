// @ts-check
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, envField } from 'astro/config'

import { getRedirects } from './src/cms/getRedirects'

export default defineConfig({
  adapter: node({ mode: 'standalone' }),
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
      PLAUSIBLE_DOMAIN: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
})
