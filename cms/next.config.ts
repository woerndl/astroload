import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(dirname, '..')

const nextConfig: NextConfig = {
  // pnpm-workspace fix: turbopack.root + outputFileTracingRoot must point at the
  // workspace root, not cms/, or Turbopack can't resolve next/package.json from src/app.
  outputFileTracingRoot: workspaceRoot,
  // Standalone output is what cms/Dockerfile runs. Gated on an env flag because
  // `next start`, the plain-Node deploy path, warns when it is set.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // The CMS is admin-only; send the bare root to the admin panel instead of 404.
  async redirects() {
    return [{ source: '/', destination: '/admin', permanent: false }]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: workspaceRoot,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
