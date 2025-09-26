# ===================================================================
# QUICK SETUP FOR NEW MACHINE
# Medical Equipment Management System - QLTBYT Nam Phong
# ===================================================================

param(
    [switch]$SkipDocker = $false,
    [switch]$Force = $false
)

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🚀 QUICK SETUP FOR NEW MACHINE" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warning($msg) { Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Info "Setting up Medical Equipment Management System development environment..."
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json") -or !(Test-Path "supabase")) {
    Write-Error "Please run this script from the project root directory"
    Write-Info "Expected: D:\qltbyt-nam-phong (or your project folder)"
    exit 1
}

Write-Success "Project directory confirmed"

# Step 1: Install Node.js dependencies
Write-Info "Step 1: Installing Node.js dependencies..."
if (Test-Path "node_modules") {
    Write-Success "node_modules already exists"
} else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed successfully"
    } else {
        Write-Error "Failed to install dependencies"
        exit 1
    }
}

# Step 2: Setup environment files
Write-Info "Step 2: Setting up environment files..."
if (Test-Path ".env.local") {
    Write-Warning ".env.local already exists - skipping"
} else {
    if (Test-Path ".env.local.development") {
        Copy-Item ".env.local.development" ".env.local"
        Write-Success "Created .env.local from template"
    } else {
        Write-Warning "No .env.local.development template found"
        Write-Info "You'll need to create .env.local manually"
    }
}

# Step 3: Check Docker (optional)
if (!$SkipDocker) {
    Write-Info "Step 3: Checking Docker installation..."
    try {
        docker --version | Out-Null
        Write-Success "Docker is installed"
        
        # Check if Docker is running
        docker ps 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker is running"
        } else {
            Write-Warning "Docker is installed but not running"
            Write-Info "Please start Docker Desktop"
        }
    } catch {
        Write-Warning "Docker not found"
        Write-Host ""
        Write-Host "To install Docker Desktop:" -ForegroundColor Yellow
        Write-Host "1. Download: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Blue
        Write-Host "2. Install and restart computer" -ForegroundColor Blue
        Write-Host "3. Start Docker Desktop" -ForegroundColor Blue
        Write-Host "4. Run: .\scripts\local-dev.ps1 -Action setup" -ForegroundColor Blue
    }
} else {
    Write-Info "Step 3: Skipping Docker check (--SkipDocker flag used)"
}

# Step 4: Check Supabase CLI
Write-Info "Step 4: Checking Supabase CLI..."
try {
    supabase --version | Out-Null
    Write-Success "Supabase CLI is installed"
} catch {
    Write-Warning "Supabase CLI not found"
    Write-Info "Installing via Scoop..."
    
    # Check Scoop
    try {
        scoop --version | Out-Null
        Write-Success "Scoop found"
    } catch {
        Write-Info "Installing Scoop package manager..."
        if (!(Test-Administrator)) {
            Write-Warning "Scoop installation may require administrator privileges"
        }
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Invoke-RestMethod get.scoop.sh | Invoke-Expression
    }
    
    # Install Supabase CLI
    scoop install supabase
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Supabase CLI installed"
    } else {
        Write-Warning "Failed to install via Scoop"
        Write-Info "Manual installation: https://github.com/supabase/cli/releases"
    }
}

# Step 5: Initialize Supabase (if needed)
Write-Info "Step 5: Checking Supabase configuration..."
if (Test-Path "supabase/config.toml") {
    Write-Success "Supabase already configured"
} else {
    Write-Info "Initializing Supabase..."
    supabase init
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Supabase initialized"
    } else {
        Write-Warning "Supabase initialization failed"
    }
}

# Step 6: Check TypeScript
Write-Info "Step 6: Running type check..."
npm run typecheck 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "TypeScript check passed"
} else {
    Write-Warning "TypeScript check failed - you may need to fix types"
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "✅ SETUP COMPLETED!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""

Write-Info "NEXT STEPS:"
Write-Host "1. Start development: .\scripts\local-dev.ps1 -Action start" -ForegroundColor Blue
Write-Host "2. View status: .\scripts\local-dev.ps1 -Action status" -ForegroundColor Blue
Write-Host "3. Get help: .\scripts\local-dev.ps1 -Action help" -ForegroundColor Blue
Write-Host ""

Write-Info "AVAILABLE WORKFLOWS:"
Write-Host "• Local Development: .\scripts\local-dev.ps1" -ForegroundColor Blue
Write-Host "• Legacy DevOps: .\scripts\devops-workflow.ps1" -ForegroundColor Blue
Write-Host "• Documentation: docs/LOCAL_DEVELOPMENT_SETUP.md" -ForegroundColor Blue
Write-Host "• Summary: DEVOPS_WORKFLOW_SUMMARY.md" -ForegroundColor Blue
Write-Host ""

Write-Success "Ready for development! 🚀"