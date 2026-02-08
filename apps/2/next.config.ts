import type { NextConfig } from 'next'

// eslint-disable-next-line no-restricted-properties
const isDev = process.env.NODE_ENV === 'development',
  config: NextConfig = {
    cacheComponents: true,
    experimental: { serverActions: { bodySizeLimit: '100mb' } },
    headers: () => [
      {
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.convex.cloud https://images.unsplash.com",
              isDev
                ? "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud http://127.0.0.1:* ws://127.0.0.1:*"
                : "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud",
              "font-src 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ],
        source: '/:path*'
      }
    ],
    images: { remotePatterns: [{ hostname: '*' }] },
    reactCompiler: true,
    transpilePackages: ['@a/ui', '@a/cv']
  }

export default config
