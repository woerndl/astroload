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
import { CollectionGroups, pageCollectionsSlugs } from './shared'
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, SITE_NAME } from './site-config'
import { stripLocalePath } from './stripLocalePath'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const s3Configured =
  !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID && !!process.env.S3_SECRET_ACCESS_KEY
const resendConfigured = !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_ADDRESS

export default buildConfig({
  serverURL: env.SERVER_URL,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ` — ${SITE_NAME}` },
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
    { path: '/page-by-path', method: 'get', handler: getPageByPath },
    { path: '/static-paths', method: 'get', handler: getStaticPaths },
  ],
  localization: {
    locales: LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] ?? code })),
    defaultLocale: DEFAULT_LOCALE,
    fallback: true,
  },
  editor: lexicalEditorWithSafeLinks(),
  // Nothing consumes GraphQL: the web app and the seed go through REST and
  // the Local API. The Next route handlers under api/graphql* are deleted
  // with it. This flag skips schema generation at init.
  graphQL: { disable: true },
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: env.DATABASE_URI,
    // Transactions require a replica set. Turning them off lets a single
    // standalone mongod work, and also sidesteps the WriteConflict retries
    // a replica set would otherwise need. See docs/astroload/maintenance.md.
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
        // Preview keeps the stored /{locale} prefix so the prefixed preview route
        // resolves. The public link drops it to match the served single-locale URL.
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
        // The plugin sets no write rules, so writes fall back to any
        // authenticated requester, including the web app's api keys: a leaked
        // read-only key could rewrite a form's emails, confirmation, and
        // redirect, or delete the form. API keys carry no roles, so the role
        // gate shuts them out.
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
        // Submissions hold visitor PII. Without this, read is open to any
        // authenticated requester (including the web app's api keys) and
        // delete falls back to the same, because the plugin sets no rule.
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
    ...(s3Configured
      ? [
          s3Storage({
            collections: {
              media: { disablePayloadAccessControl: true },
            },
            bucket: process.env.S3_BUCKET!,
            acl: 'public-read',
            config: {
              endpoint: process.env.S3_ENDPOINT,
              region: process.env.S3_REGION ?? 'auto',
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID!,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
              },
            },
          }),
        ]
      : []),
  ],
})
