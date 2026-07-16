import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(dirname, '..')

const nextConfig: NextConfig = {
  // Trace standalone output from the workspace root, not cms/, so the Docker
  // image gets the dependencies pnpm hoists to the workspace root.
  outputFileTracingRoot: workspaceRoot,
  // cms/Dockerfile runs standalone output. The env flag avoids a warning from
  // `next start`, which does not use standalone output.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // The CMS is admin-only. Send the bare root to the admin panel instead of 404.
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
  // Without the workspace root, Turbopack can't resolve next/package.json
  // from src/app in this pnpm workspace.
  turbopack: {
    root: workspaceRoot,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
