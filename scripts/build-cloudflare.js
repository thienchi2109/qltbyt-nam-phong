#!/usr/bin/env node

/**
 * Windows-compatible Cloudflare Workers build script
 * This script handles the build process for Cloudflare Workers deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${colors.blue}📦 ${description}...${colors.reset}`);
  try {
    execSync(command, { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_WORKERS: 'true' } });
    log(`${colors.green}✅ ${description} completed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ ${description} failed: ${error.message}${colors.reset}`);
    return false;
  }
}

async function buildCloudflare() {
  log(`${colors.cyan}${colors.bright}🚀 Building for Cloudflare Workers${colors.reset}\n`);

  // Step 1: Clean previous builds
  log(`${colors.blue}🧹 Cleaning previous builds...${colors.reset}`);
  try {
    if (fs.existsSync('.next')) {
      fs.rmSync('.next', { recursive: true, force: true });
    }
    if (fs.existsSync('.vercel/output')) {
      fs.rmSync('.vercel/output', { recursive: true, force: true });
    }
    log(`${colors.green}✅ Cleanup completed${colors.reset}`);
  } catch (error) {
    log(`${colors.yellow}⚠️  Cleanup warning: ${error.message}${colors.reset}`);
  }

  // Step 2: Build Next.js with Cloudflare Workers environment
  const buildSuccess = execCommand('next build', 'Building Next.js application for Cloudflare Workers');
  
  if (!buildSuccess) {
    log(`${colors.red}💥 Build failed${colors.reset}`);
    process.exit(1);
  }

  // Step 3: Check if output directory exists
  if (!fs.existsSync('out')) {
    log(`${colors.red}❌ Export directory 'out' not found. Make sure output: 'export' is set in next.config.ts${colors.reset}`);
    process.exit(1);
  }

  // Step 4: Cloudflare Pages uses the 'out' directory directly
  log(`${colors.blue}📁 Preparing for Cloudflare Pages deployment...${colors.reset}`);
  try {
    // Check if output directory exists
    if (!fs.existsSync('out')) {
      log(`${colors.red}❌ Export directory 'out' not found${colors.reset}`);
      process.exit(1);
    }

    // Copy _headers file to out directory for Cloudflare Pages
    if (fs.existsSync('_headers')) {
      fs.copyFileSync('_headers', path.join('out', '_headers'));
      log(`${colors.green}✅ Headers configuration copied${colors.reset}`);
    }

    // Create _redirects file for SPA routing
    const redirects = `
# SPA routing - redirect all routes to index.html
/*    /index.html   200
`;
    fs.writeFileSync(path.join('out', '_redirects'), redirects.trim());

    log(`${colors.green}✅ Cloudflare Pages structure ready${colors.reset}`);
  } catch (error) {
    log(`${colors.red}❌ Failed to prepare Cloudflare structure: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  log(`\n${colors.green}${colors.bright}🎉 Cloudflare Pages build completed successfully!${colors.reset}`);
  log(`${colors.cyan}📁 Output directory: out${colors.reset}`);
  log(`${colors.cyan}🚀 Ready for deployment to Cloudflare Pages${colors.reset}`);
}

// Run the build
buildCloudflare().catch(error => {
  log(`${colors.red}💥 Build script failed: ${error.message}${colors.reset}`);
  process.exit(1);
});
