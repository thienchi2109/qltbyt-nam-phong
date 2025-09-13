#!/usr/bin/env node

/**
 * Dual deployment script for Vercel and Cloudflare Workers
 * This script handles deployment to both platforms simultaneously
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
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${colors.blue}📦 ${description}...${colors.reset}`);
  try {
    execSync(command, { stdio: 'inherit' });
    log(`${colors.green}✅ ${description} completed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ ${description} failed: ${error.message}${colors.reset}`);
    return false;
  }
}

async function deployDual() {
  log(`${colors.cyan}${colors.bright}🚀 Starting Dual Deployment Process${colors.reset}`);
  log(`${colors.cyan}Deploying to both Vercel and Cloudflare Workers...${colors.reset}\n`);

  const results = {
    vercel: false,
    cloudflare: false
  };

  // Step 1: Build for Vercel (standard Next.js build)
  log(`${colors.magenta}${colors.bright}📋 Phase 1: Vercel Deployment${colors.reset}`);
  results.vercel = execCommand('npm run build:vercel', 'Building for Vercel');

  if (results.vercel) {
    // Deploy to Vercel (if vercel CLI is available)
    if (fs.existsSync('vercel.json') || process.env.VERCEL_TOKEN) {
      results.vercel = execCommand('vercel --prod', 'Deploying to Vercel');
    } else {
      log(`${colors.yellow}⚠️  Vercel deployment skipped (no vercel.json or VERCEL_TOKEN)${colors.reset}`);
      log(`${colors.yellow}   Push to your repository to trigger Vercel deployment${colors.reset}`);
    }
  }

  // Step 2: Build for Cloudflare Workers
  log(`\n${colors.magenta}${colors.bright}📋 Phase 2: Cloudflare Workers Deployment${colors.reset}`);
  results.cloudflare = execCommand('npm run build:cloudflare', 'Building for Cloudflare Workers');

  if (results.cloudflare) {
    // Deploy to Cloudflare Workers
    if (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN) {
      results.cloudflare = execCommand('npm run deploy:cloudflare', 'Deploying to Cloudflare Workers');
    } else {
      log(`${colors.yellow}⚠️  Cloudflare deployment skipped (no API token)${colors.reset}`);
      log(`${colors.yellow}   Run 'npm run cf:login' and set CLOUDFLARE_API_TOKEN${colors.reset}`);
    }
  }

  // Summary
  log(`\n${colors.cyan}${colors.bright}📊 Deployment Summary${colors.reset}`);
  log(`${colors.cyan}═══════════════════════════${colors.reset}`);
  
  if (results.vercel) {
    log(`${colors.green}✅ Vercel: Successfully deployed${colors.reset}`);
  } else {
    log(`${colors.red}❌ Vercel: Deployment failed or skipped${colors.reset}`);
  }

  if (results.cloudflare) {
    log(`${colors.green}✅ Cloudflare Workers: Successfully deployed${colors.reset}`);
  } else {
    log(`${colors.red}❌ Cloudflare Workers: Deployment failed or skipped${colors.reset}`);
  }

  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  if (successCount === totalCount) {
    log(`\n${colors.green}${colors.bright}🎉 All deployments completed successfully!${colors.reset}`);
    process.exit(0);
  } else if (successCount > 0) {
    log(`\n${colors.yellow}${colors.bright}⚠️  Partial deployment success (${successCount}/${totalCount})${colors.reset}`);
    process.exit(1);
  } else {
    log(`\n${colors.red}${colors.bright}💥 All deployments failed${colors.reset}`);
    process.exit(1);
  }
}

// Run the deployment
deployDual().catch(error => {
  log(`${colors.red}💥 Deployment script failed: ${error.message}${colors.reset}`);
  process.exit(1);
});
