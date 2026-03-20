import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Prisma v7 imports @prisma/client/runtime/client at runtime.
  // Turbopack must not bundle it — treat as external Node.js module.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  cacheComponents: true,
}

export default nextConfig
