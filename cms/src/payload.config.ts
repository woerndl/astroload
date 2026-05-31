import { payloadPagesPlugin } from '@jhb.software/payload-pages-plugin'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

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
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URI,
    },
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
        // resolves; the public link drops it to match the served single-locale URL.
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
        state: false,
        upload: false,
      },
      formOverrides: {
        admin: { group: CollectionGroups.System },
      },
      formSubmissionOverrides: {
        admin: { group: CollectionGroups.System },
        hooks: {
          beforeChange: [spamGuard],
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
