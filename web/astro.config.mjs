// @ts-check
import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  env: {
    schema: {
      PAYLOAD_READ_KEY: envField.string({ context: 'server', access: 'secret' }),
      PAYLOAD_PREVIEW_KEY: envField.string({ context: 'server', access: 'secret' }),
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
