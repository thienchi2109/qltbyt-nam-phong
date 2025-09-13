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
