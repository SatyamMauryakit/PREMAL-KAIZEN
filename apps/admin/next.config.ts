import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const apiHost = new URL(apiUrl);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produces .next/standalone - a self-contained server bundle with only the
  // dependencies this app actually uses, for a much smaller Docker runtime image.
  // Gated behind an env var rather than always on: tracing/copying node_modules for
  // the standalone bundle requires creating symlinks, which fails with EPERM on
  // Windows unless Developer Mode is enabled (confirmed - a plain `npm run build`
  // here fails outright with it unconditionally enabled). The eventual Linux Docker
  // build has no such restriction and should set NEXT_OUTPUT_STANDALONE=true.
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    formats: ['image/avif', 'image/webp'],
    // The only real remote image source today is this app's own API, which serves
    // product images from /uploads/*. No next/image usage exists in this codebase
    // yet (plain <img> is used everywhere), so this currently has no functional
    // effect - it's here so the allowlist is already correct the moment next/image
    // is adopted, rather than defaulting to the previous wildcard ('**' - any host).
    remotePatterns: [
      {
        protocol: apiHost.protocol.replace(':', '') as 'http' | 'https',
        hostname: apiHost.hostname,
        port: apiHost.port || undefined,
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
};

export default nextConfig;
