#!/usr/bin/env node

/**
 * CI/CD Setup Script
 * Helps configure GitHub secrets and verify CI/CD pipeline setup
 */

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

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}`, colors.green);
    return true;
  } else {
    log(`❌ ${description}`, colors.red);
    return false;
  }
}

function checkEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, vars: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const vars = content
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => line.split('=')[0].trim());

  return { exists: true, vars };
}

async function setupCICD() {
  log(`${colors.cyan}${colors.bright}🚀 CI/CD Pipeline Setup Verification${colors.reset}\n`);

  let allGood = true;

  // Check workflow files
  log(`${colors.magenta}${colors.bright}📋 Checking GitHub Actions Workflows${colors.reset}`);
  const workflowChecks = [
    checkFile('.github/workflows/deploy-dual.yml', 'Dual deployment workflow'),
    checkFile('.github/workflows/preview-deploy.yml', 'Preview deployment workflow')
  ];
  allGood = allGood && workflowChecks.every(Boolean);

  // Check configuration files
  log(`\n${colors.magenta}${colors.bright}📋 Checking Configuration Files${colors.reset}`);
  const configChecks = [
    checkFile('wrangler.toml', 'Cloudflare Workers configuration'),
    checkFile('next.config.ts', 'Next.js configuration'),
    checkFile('package.json', 'Package.json with deployment scripts'),
    checkFile('DEPLOYMENT.md', 'Deployment documentation'),
    checkFile('CI-CD.md', 'CI/CD documentation')
  ];
  allGood = allGood && configChecks.every(Boolean);

  // Check environment files
  log(`\n${colors.magenta}${colors.bright}📋 Checking Environment Configuration${colors.reset}`);
  const localEnv = checkEnvFile('.env.local');
  const cloudflareEnv = checkEnvFile('.env.cloudflare');

  if (localEnv.exists) {
    log(`✅ Local environment file (.env.local)`, colors.green);
  } else {
    log(`❌ Local environment file (.env.local) missing`, colors.red);
    allGood = false;
  }

  if (cloudflareEnv.exists) {
    log(`✅ Cloudflare environment file (.env.cloudflare)`, colors.green);
  } else {
    log(`❌ Cloudflare environment file (.env.cloudflare) missing`, colors.red);
    allGood = false;
  }

  // Check required environment variables
  log(`\n${colors.magenta}${colors.bright}📋 Required Environment Variables${colors.reset}`);
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const localVars = localEnv.vars || [];
  const cloudflareVars = cloudflareEnv.vars || [];

  requiredVars.forEach(varName => {
    const inLocal = localVars.includes(varName);
    const inCloudflare = cloudflareVars.includes(varName);

    if (inLocal && inCloudflare) {
      log(`✅ ${varName} (configured in both environments)`, colors.green);
    } else if (inLocal) {
      log(`⚠️  ${varName} (only in .env.local)`, colors.yellow);
    } else if (inCloudflare) {
      log(`⚠️  ${varName} (only in .env.cloudflare)`, colors.yellow);
    } else {
      log(`❌ ${varName} (missing from both environments)`, colors.red);
      allGood = false;
    }
  });

  // Check package.json scripts
  log(`\n${colors.magenta}${colors.bright}📋 Checking Deployment Scripts${colors.reset}`);
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'build:vercel',
    'build:cloudflare',
    'deploy:dual',
    'cf:login',
    'cf:preview'
  ];

  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      log(`✅ npm run ${script}`, colors.green);
    } else {
      log(`❌ npm run ${script} (missing)`, colors.red);
      allGood = false;
    }
  });

  // GitHub Secrets checklist
  log(`\n${colors.magenta}${colors.bright}📋 GitHub Secrets Checklist${colors.reset}`);
  log(`${colors.cyan}Configure these secrets in GitHub repository settings:${colors.reset}\n`);

  const secrets = [
    { name: 'VERCEL_TOKEN', description: 'Vercel API token' },
    { name: 'VERCEL_ORG_ID', description: 'Vercel organization ID' },
    { name: 'VERCEL_PROJECT_ID', description: 'Vercel project ID' },
    { name: 'CLOUDFLARE_API_TOKEN', description: 'Cloudflare API token' },
    { name: 'CLOUDFLARE_ACCOUNT_ID', description: 'Cloudflare account ID' },
    { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase anonymous key' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' }
  ];

  secrets.forEach(secret => {
    log(`☐ ${secret.name} - ${secret.description}`, colors.cyan);
  });

  // Summary
  log(`\n${colors.cyan}${colors.bright}📊 Setup Summary${colors.reset}`);
  log(`${colors.cyan}═══════════════════════════${colors.reset}`);

  if (allGood) {
    log(`${colors.green}${colors.bright}🎉 CI/CD pipeline setup is complete!${colors.reset}`);
    log(`${colors.green}✅ All configuration files are present${colors.reset}`);
    log(`${colors.green}✅ All required scripts are available${colors.reset}`);
    log(`${colors.green}✅ Environment variables are configured${colors.reset}\n`);
    
    log(`${colors.cyan}${colors.bright}🚀 Next Steps:${colors.reset}`);
    log(`${colors.cyan}1. Configure GitHub secrets (see checklist above)${colors.reset}`);
    log(`${colors.cyan}2. Push to main branch to trigger first deployment${colors.reset}`);
    log(`${colors.cyan}3. Monitor deployments in GitHub Actions tab${colors.reset}`);
  } else {
    log(`${colors.red}${colors.bright}⚠️  CI/CD pipeline setup needs attention${colors.reset}`);
    log(`${colors.red}Please fix the issues marked with ❌ above${colors.reset}\n`);
    
    log(`${colors.cyan}${colors.bright}🔧 Troubleshooting:${colors.reset}`);
    log(`${colors.cyan}1. Run 'npm install' to ensure all dependencies are installed${colors.reset}`);
    log(`${colors.cyan}2. Check that all configuration files are present${colors.reset}`);
    log(`${colors.cyan}3. Verify environment variables are set correctly${colors.reset}`);
  }

  log(`\n${colors.cyan}📚 Documentation:${colors.reset}`);
  log(`${colors.cyan}- Deployment Guide: DEPLOYMENT.md${colors.reset}`);
  log(`${colors.cyan}- CI/CD Guide: CI-CD.md${colors.reset}`);
  log(`${colors.cyan}- GitHub Actions: .github/workflows/${colors.reset}`);

  process.exit(allGood ? 0 : 1);
}

// Run the setup verification
setupCICD().catch(error => {
  log(`${colors.red}💥 Setup verification failed: ${error.message}${colors.reset}`);
  process.exit(1);
});
