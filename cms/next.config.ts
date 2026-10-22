import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(dirname, '..')

const nextConfig: NextConfig = {
  // Trace standalone output from the workspace root so the Docker image gets
  // the dependencies pnpm hoists there.
  outputFileTracingRoot: workspaceRoot,
  // Only cms/Dockerfile sets NEXT_OUTPUT=standalone, because `next start`
  // warns when output is standalone.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // Next 16.3 writes cms/AGENTS.md on every `next dev` run by a coding agent.
  // This repo keeps agent guidance in the root AGENTS.md.
  agentRules: false,
  // The CMS has no public pages, so / redirects to the admin panel.
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
