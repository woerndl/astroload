import { payloadPagesPlugin } from '@jhb.software/payload-pages-plugin'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
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
import { env } from './env'
import { Footer } from './globals/Footer'
import { Header } from './globals/Header'
import { Labels } from './globals/Labels'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const s3Configured =
  !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID && !!process.env.S3_SECRET_ACCESS_KEY
const resendConfigured = !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_ADDRESS

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Pages, Posts, Authors, Media, ApiKeys, Redirects, Users],
  globals: [Header, Footer, Labels, SiteSettings],
  cors: [env.WEBSITE_URL],
  csrf: [env.WEBSITE_URL],
  localization: {
    locales: [
      { code: 'de', label: 'Deutsch' },
      { code: 'en', label: 'English' },
    ],
    defaultLocale: 'de',
    fallback: true,
  },
  editor: lexicalEditor(),
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
      generatePageURL: ({ path: pagePath, preview }) =>
        pagePath ? `${env.WEBSITE_URL}${preview ? '/preview' : ''}${pagePath}` : null,
    }),
    seoPlugin({
      collections: ['pages', 'posts'],
      uploadsCollection: 'media',
      generateURL: ({ doc }) =>
        typeof doc?.path === 'string' ? `${env.WEBSITE_URL}${doc.path}` : '',
      generateTitle: ({ doc }) => (typeof doc?.title === 'string' ? doc.title : ''),
    }),
    formBuilderPlugin({}),
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
