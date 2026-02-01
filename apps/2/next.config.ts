import type { NextConfig } from 'next'

const config: NextConfig = {
  cacheComponents: true,
  experimental: { serverActions: { bodySizeLimit: '100mb' } },
  images: { remotePatterns: [{ hostname: '*' }] },
  reactCompiler: true,
  transpilePackages: ['@a/ui', '@a/cv'],
  typescript: { ignoreBuildErrors: true }
}

export default config
