import type {NextConfig} from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable PWA in development
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Cloudflare Workers compatibility
  experimental: {
    // Enable experimental features for better Cloudflare Workers support
  },
  // Fix for app-build-manifest.json 404 error
  async headers() {
    return [
      {
        source: '/_next/app-build-manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Output configuration for dual deployment
  output: process.env.CLOUDFLARE_WORKERS ? 'export' : undefined,
  trailingSlash: process.env.CLOUDFLARE_WORKERS ? true : false,
  // Image configuration with Cloudflare Workers compatibility
  images: {
    unoptimized: process.env.CLOUDFLARE_WORKERS ? true : false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.postimg.cc',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default withPWA(nextConfig);
