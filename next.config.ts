import type { NextConfig } from 'next'
import path from 'path'
import bundleAnalyzer from '@next/bundle-analyzer'

  const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  })

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Prisma v7 imports @prisma/client/runtime/client at runtime.
  // Turbopack must not bundle it — treat as external Node.js module.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  cacheComponents: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default withBundleAnalyzer(nextConfig)