# Dual Deployment Guide: Vercel + Cloudflare Workers

This medical equipment management application is configured for dual deployment to both **Vercel** and **Cloudflare Workers** for improved performance and redundancy.

## 🏗️ Architecture Overview

- **Vercel**: Primary deployment platform (existing)
- **Cloudflare Workers**: Secondary deployment for improved global performance
- **Supabase**: Database backend (works with both platforms)
- **Real-time features**: Supported on both platforms

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 18+ installed
2. **Vercel CLI** (optional, for manual deployments)
3. **Wrangler CLI** (installed via npm)
4. **Cloudflare account** with Workers enabled

### Environment Setup

1. **Copy environment variables**:
   ```bash
   cp .env.local .env.cloudflare
   ```

2. **Configure Cloudflare Workers environment variables** in the dashboard:
   - Go to Cloudflare Dashboard > Workers & Pages > Your App > Settings > Environment Variables
   - Add all variables from `.env.cloudflare`

### Authentication

```bash
# Login to Cloudflare
npm run cf:login

# Verify Vercel connection (if using CLI)
vercel login
```

## 📦 Build Commands

```bash
# Build for Vercel (standard Next.js)
npm run build:vercel

# Build for Cloudflare Workers
npm run build:cloudflare

# Build for both platforms
npm run deploy:dual
```

## 🌐 Deployment Commands

```bash
# Deploy to both platforms simultaneously
npm run deploy:all

# Deploy to Cloudflare Workers only
npm run deploy:cloudflare

# Preview Cloudflare Workers locally
npm run cf:preview
```

## ⚙️ Configuration Files

- `wrangler.toml` - Cloudflare Workers configuration
- `next.config.ts` - Next.js configuration with dual platform support
- `.env.cloudflare` - Environment variables template for Cloudflare

## 🔧 Platform-Specific Features

### Vercel
- ✅ Full Next.js features
- ✅ Image optimization
- ✅ Server-side rendering
- ✅ API routes

### Cloudflare Workers
- ✅ Edge runtime
- ✅ Global distribution
- ✅ Static site generation
- ⚠️ Limited Node.js APIs
- ⚠️ No image optimization

## 🚨 Important Notes

1. **Environment Variables**: Must be configured separately in each platform
2. **Database**: Both platforms use the same Supabase instance
3. **Real-time**: Supabase real-time works on both platforms
4. **Images**: Cloudflare Workers uses unoptimized images
5. **API Routes**: Some API routes may need edge runtime compatibility

## 🔍 Troubleshooting

### Common Issues

1. **Build fails for Cloudflare**:
   - Check Node.js compatibility
   - Verify environment variables
   - Review edge runtime limitations

2. **Supabase connection issues**:
   - Verify environment variables are set correctly
   - Check network connectivity
   - Ensure Supabase URL and keys are valid

3. **Real-time features not working**:
   - Verify Supabase real-time is enabled
   - Check WebSocket connections
   - Review browser console for errors

## 📊 Performance Monitoring

Monitor both deployments:
- **Vercel**: Vercel Analytics Dashboard
- **Cloudflare**: Cloudflare Analytics Dashboard
- **Database**: Supabase Dashboard

## 🔄 CI/CD Integration

The dual deployment can be integrated with GitHub Actions or other CI/CD platforms. See the next section for CI/CD setup.

## 📞 Support

For deployment issues:
1. Check the deployment logs
2. Verify environment variables
3. Test locally with `npm run cf:preview`
4. Review platform-specific documentation
