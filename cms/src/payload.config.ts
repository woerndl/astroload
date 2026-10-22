import { payloadPagesPlugin } from '@jhb.software/payload-pages-plugin'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { isAdmin } from './access/isAdmin'
import { isAdminOrEditor } from './access/isAdminOrEditor'
import { isPanelUser } from './access/isPanelUser'
import { ApiKeys } from './collections/ApiKeys'
import { Authors } from './collections/Authors'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Redirects } from './collections/Redirects'
import { Users } from './collections/Users'
import { getGlobalData } from './endpoints/globalData'
import { getHealth } from './endpoints/health'
import { getPageByPath } from './endpoints/pageByPath'
import { getStaticPaths } from './endpoints/staticPaths'
import { env } from './env'
import { lexicalEditorWithSafeLinks } from './lexical/editor'
import { spamGuard } from './hooks/spamGuard'
import {
  triggerDeployAlwaysAfterChange,
  triggerDeployAlwaysAfterDelete,
} from './hooks/triggerDeploy'
import { validateFormFields } from './hooks/validateFormFields'
import { validateSubmission } from './hooks/validateSubmission'
import { Footer } from './globals/Footer'
import { Header } from './globals/Header'
import { Labels } from './globals/Labels'
import { SiteSettings } from './globals/SiteSettings'
import { CollectionGroups, DATE_FORMAT, pageCollectionsSlugs } from './shared'
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, SITE_NAME } from './site-config'
import { stripLocalePath } from './stripLocalePath'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// An integration turns on only when all its env vars are set. A partly set
// group logs a warning, so a mistyped var name does not leave S3 or email off
// unnoticed.
function isConfigured(label: string, vars: Record<string, string | undefined>): boolean {
  const set = Object.values(vars).filter(Boolean).length
  const names = Object.keys(vars)
  if (set > 0 && set < names.length) {
    const missing = names.filter((name) => !vars[name])
    console.warn(
      `[astroload] ${label} is partially configured. It stays off until you set: ${missing.join(', ')}`,
    )
  }
  return set === names.length
}

const s3Configured = isConfigured('S3 storage', {
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
})
const resendConfigured = isConfigured('Resend email', {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_ADDRESS: process.env.RESEND_FROM_ADDRESS,
})

export default buildConfig({
  serverURL: env.SERVER_URL,
  admin: {
    user: Users.slug,
    dateFormat: DATE_FORMAT,
    components: {
      graphics: {
        Logo: './admin/Logo#Logo',
        Icon: './admin/Logo#Icon',
      },
    },
    // Payload's /api/og route fails with a custom graphics.Icon, because it
    // reads req.payload.importMap, which is not set when a REST route handles
    // the request. The admin needs no generated share image.
    meta: { titleSuffix: ` — ${SITE_NAME}`, defaultOGImageType: 'off' },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Pages, Posts, Authors, Media, ApiKeys, Redirects, Users],
  globals: [Header, Footer, Labels, SiteSettings],
  cors: [env.WEBSITE_URL],
  csrf: [env.WEBSITE_URL],
  endpoints: [
    { path: '/global-data', method: 'get', handler: getGlobalData },
    { path: '/health', method: 'get', handler: getHealth },
    { path: '/page-by-path', method: 'get', handler: getPageByPath },
    { path: '/static-paths', method: 'get', handler: getStaticPaths },
  ],
  localization: {
    locales: LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] ?? code })),
    defaultLocale: DEFAULT_LOCALE,
    fallback: true,
  },
  editor: lexicalEditorWithSafeLinks(),
  // The web app and the seed use REST and the Local API, and the app has no
  // api/graphql* route handlers. This flag skips schema generation at init.
  graphQL: { disable: true },
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: env.DATABASE_URI,
    // Transactions need a replica set. Without them a standalone mongod works
    // and there are no WriteConflict retries. See docs/astroload/maintenance.md.
    transactionOptions: false,
  }),
  ...(resendConfigured
    ? {
        email: resendAdapter({
          apiKey: process.env.RESEND_API_KEY!,
          defaultFromAddress: process.env.RESEND_FROM_ADDRESS!,
          defaultFromName: process.env.RESEND_FROM_NAME ?? 'Payload CMS',
        }),
      }
    : {}),
  sharp,
  plugins: [
    payloadPagesPlugin({
      generatePageURL: ({ path: pagePath, preview }) => {
        if (!pagePath) return null
        // Preview keeps the stored /{locale} prefix for the preview route. The
        // public link matches the served URL.
        const linkPath = preview ? pagePath : stripLocalePath(pagePath)
        const url = new URL(`${preview ? '/preview' : ''}${linkPath}`, env.WEBSITE_URL)
        if (preview) url.searchParams.set('previewSecret', env.PREVIEW_SECRET)
        return url.toString()
      },
    }),
    seoPlugin({
      collections: [...pageCollectionsSlugs],
      uploadsCollection: 'media',
      generateURL: ({ doc }) =>
        typeof doc?.path === 'string'
          ? new URL(stripLocalePath(doc.path), env.WEBSITE_URL).toString()
          : '',
      generateTitle: ({ doc }) => {
        if (typeof doc?.title === 'string') return doc.title
        if (typeof doc?.name === 'string') return doc.name
        return ''
      },
    }),
    formBuilderPlugin({
      fields: {
        country: false,
        date: false,
        payment: false,
        // The web field renderer has no radio branch and would show a radio
        // group as a text input.
        radio: false,
        state: false,
        upload: false,
      },
      formOverrides: {
        // The plugin sets no write rules, so any authenticated requester could
        // write, including the web app's API keys. A leaked read-only key could
        // then rewrite a form's emails, confirmation, and redirect, or delete
        // the form. API keys have no roles, so isAdminOrEditor rejects them.
        access: {
          create: isAdminOrEditor,
          update: isAdminOrEditor,
          delete: isAdminOrEditor,
        },
        admin: { group: CollectionGroups.System },
        hooks: {
          beforeValidate: [validateFormFields],
          // Forms are baked into the prerendered pages that embed them, so a
          // form edit needs a rebuild like any other content change.
          afterChange: [triggerDeployAlwaysAfterChange],
          afterDelete: [triggerDeployAlwaysAfterDelete],
        },
      },
      formSubmissionOverrides: {
        // Submissions hold visitor PII. The plugin default limits read to the
        // admin auth collection but sets no delete rule, so delete would fall
        // back to any authenticated requester, including the api keys.
        access: {
          create: () => true,
          read: isPanelUser,
          update: () => false,
          delete: isAdmin,
        },
        admin: { group: CollectionGroups.System },
        hooks: {
          beforeChange: [spamGuard, validateSubmission],
        },
      },
    }),
    // Kept in the list and switched with `enabled`. The plugin registers its
    // admin component either way, so leaving it out without S3 env would make
    // a local `generate:importmap` drop an entry that S3 deployments need, and
    // their admin would render blank.
    s3Storage({
      enabled: s3Configured,
      collections: { media: true },
      bucket: process.env.S3_BUCKET!,
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'auto',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
      },
    }),
  ],
})
