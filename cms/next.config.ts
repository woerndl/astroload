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
