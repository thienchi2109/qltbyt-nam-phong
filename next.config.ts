import type {NextConfig} from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  reloadOnOnline: true,
  // Exclude internal Next.js manifest that is not publicly served on some deployments.
  exclude: [/app-build-manifest\.json$/],
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
  images: {
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
      },
      // Additional image hosts for tenant logos
      {
        protocol: 'https',
        hostname: 'postimg.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgbb.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imagizer.imageshack.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imageshack.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default withSerwist(nextConfig);
