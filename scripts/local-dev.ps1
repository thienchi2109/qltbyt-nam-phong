# ===================================================================
# LOCAL DEVELOPMENT WORKFLOW SCRIPT
# Medical Equipment Management System - QLTBYT Nam Phong
# ===================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("setup", "start", "stop", "reset", "new-migration", "test-migration", "deploy", "status", "help")]
    [string]$Action,
    
    [string]$MigrationName = "",
    [string]$MigrationFile = "",
    [switch]$Force = $false
)

# Colors for better output
function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warning($msg) { Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Header($msg) { 
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Cyan
    Write-Host "🚀 $msg" -ForegroundColor Cyan
    Write-Host "=================================================" -ForegroundColor Cyan
}

function Show-Help() {
    Write-Header "LOCAL DEVELOPMENT WORKFLOW"
    Write-Host ""
    Write-Info "USAGE: .\scripts\local-dev.ps1 -Action ACTION [options]"
    Write-Host ""
    Write-Host "ACTIONS:" -ForegroundColor Yellow
    Write-Host "  setup           - First time setup (Docker + Supabase CLI)" -ForegroundColor Blue
    Write-Host "  start           - Start local Supabase + Next.js dev server" -ForegroundColor Blue  
    Write-Host "  stop            - Stop local development environment" -ForegroundColor Blue
    Write-Host "  reset           - Reset local database to latest migrations" -ForegroundColor Blue
    Write-Host "  new-migration   - Create new migration file" -ForegroundColor Blue
    Write-Host "  test-migration  - Test specific migration file" -ForegroundColor Blue
    Write-Host "  deploy          - Deploy tested migrations to production" -ForegroundColor Blue
    Write-Host "  status          - Show current development status" -ForegroundColor Blue
    Write-Host "  help            - Show this help message" -ForegroundColor Blue
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor Yellow
    Write-Host "  .\scripts\local-dev.ps1 -Action setup" -ForegroundColor Green
    Write-Host "  .\scripts\local-dev.ps1 -Action start" -ForegroundColor Green
    Write-Host "  .\scripts\local-dev.ps1 -Action new-migration -MigrationName add_equipment_status" -ForegroundColor Green
    Write-Host "  .\scripts\local-dev.ps1 -Action deploy" -ForegroundColor Green
}

function Test-Prerequisites() {
    Write-Info "Checking prerequisites..."
    
    $errors = @()
    
    # Check if we're in project root
    if (!(Test-Path "package.json")) {
        $errors += "Not in project root directory. Please run from D:\qltbyt-nam-phong"
    }
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            $errors += "Docker not found. Please install Docker Desktop"
        } else {
            Write-Success "Docker found: $dockerVersion"
        }
    } catch {
        $errors += "Docker not found. Please install Docker Desktop"
    }
    
    # Check Supabase CLI
    try {
        $supabaseVersion = supabase --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            $errors += "Supabase CLI not found. Run setup first"
        } else {
            Write-Success "Supabase CLI found: $supabaseVersion"
        }
    } catch {
        $errors += "Supabase CLI not found. Run setup first"
    }
    
    if ($errors.Count -gt 0) {
        Write-Error "Prerequisites not met:"
        foreach ($error in $errors) {
            Write-Error "  - $error"
        }
        Write-Host ""
        Write-Info "Run: .\scripts\local-dev.ps1 -Action setup"
        exit 1
    }
    
    Write-Success "All prerequisites met!"
}

function Setup-Environment() {
    Write-Header "FIRST TIME SETUP"
    
    Write-Info "This will guide you through setting up local development environment"
    Write-Host ""
    
    # Check Docker
    Write-Info "Step 1: Checking Docker..."
    try {
        docker --version | Out-Null
        Write-Success "Docker is already installed"
    } catch {
        Write-Warning "Docker not found!"
        Write-Host ""
        Write-Host "Please install Docker Desktop:" -ForegroundColor Yellow
        Write-Host "1. Download: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Blue
        Write-Host "2. Install and restart your computer" -ForegroundColor Blue
        Write-Host "3. Start Docker Desktop" -ForegroundColor Blue
        Write-Host "4. Run this script again" -ForegroundColor Blue
        return
    }
    
    # Check Supabase CLI
    Write-Info "Step 2: Installing Supabase CLI..."
    try {
        supabase --version | Out-Null
        Write-Success "Supabase CLI is already installed"
    } catch {
        Write-Info "Installing Supabase CLI via Scoop..."
        
        # Check if Scoop is installed
        try {
            scoop --version | Out-Null
            Write-Success "Scoop found"
        } catch {
            Write-Info "Installing Scoop package manager..."
            Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Invoke-RestMethod get.scoop.sh | Invoke-Expression
        }
        
        # Install Supabase CLI
        scoop install supabase
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Supabase CLI installed successfully!"
        } else {
            Write-Error "Failed to install Supabase CLI via Scoop"
            Write-Info "Please install manually from: https://github.com/supabase/cli/releases"
            return
        }
    }
    
    # Initialize Supabase project
    Write-Info "Step 3: Initializing Supabase local project..."
    if (!(Test-Path "supabase/config.toml")) {
        supabase init
        Write-Success "Supabase project initialized"
    } else {
        Write-Success "Supabase project already initialized"
    }
    
    Write-Success "Setup completed!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "1. Run: .\scripts\local-dev.ps1 -Action start" -ForegroundColor Blue
    Write-Host "2. Visit http://localhost:54323 for Supabase Studio" -ForegroundColor Blue
    Write-Host "3. Visit http://localhost:3000 for your app" -ForegroundColor Blue
}

function Start-Development() {
    Write-Header "STARTING LOCAL DEVELOPMENT"
    Test-Prerequisites
    
    # Start Supabase
    Write-Info "Starting Supabase local..."
    supabase start
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Supabase local started!"
        Write-Host ""
        Write-Info "Supabase Studio: http://localhost:54323"
        Write-Info "API URL: http://localhost:54321"
        Write-Host ""
        
        # Start Next.js dev server
        Write-Info "Starting Next.js development server..."
        Write-Warning "Make sure you have .env.local.development configured!"
        
        # Copy local env if exists
        if (Test-Path ".env.local.development") {
            Copy-Item ".env.local.development" ".env.local" -Force
            Write-Success "Using local development environment variables"
        }
        
        npm run dev
    } else {
        Write-Error "Failed to start Supabase local"
    }
}

function Stop-Development() {
    Write-Header "STOPPING LOCAL DEVELOPMENT"
    
    Write-Info "Stopping Supabase local..."
    supabase stop
    
    Write-Info "Stopping any running Next.js processes..."
    Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Success "Local development environment stopped"
}

function Reset-Database() {
    Write-Header "RESETTING LOCAL DATABASE"
    Test-Prerequisites
    
    Write-Warning "This will reset your local database to the latest migrations"
    Write-Warning "All local data will be lost!"
    Write-Host ""
    
    if (!$Force) {
        $confirm = Read-Host "Continue? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Info "Reset cancelled"
            return
        }
    }
    
    Write-Info "Resetting database..."
    supabase db reset
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database reset completed!"
    } else {
        Write-Error "Database reset failed"
    }
}

function New-Migration() {
    Write-Header "CREATING NEW MIGRATION"
    Test-Prerequisites
    
    if ($MigrationName -eq "") {
        $MigrationName = Read-Host "Migration name (snake_case)"
    }
    
    if ($MigrationName -eq "") {
        Write-Error "Migration name is required"
        return
    }
    
    Write-Info "Creating migration: $MigrationName"
    supabase migration new $MigrationName
    
    if ($LASTEXITCODE -eq 0) {
        $migrationFiles = Get-ChildItem "supabase/migrations" -Name | Where-Object { $_ -like "*$MigrationName*" }
        Write-Success "Migration created: $migrationFiles"
        Write-Host ""
        Write-Info "Next steps:"
        Write-Host "1. Edit the migration file in supabase/migrations/" -ForegroundColor Blue
        Write-Host "2. Test with: .\scripts\local-dev.ps1 -Action test-migration -MigrationFile $migrationFiles" -ForegroundColor Blue
    } else {
        Write-Error "Failed to create migration"
    }
}

function Test-Migration() {
    Write-Header "TESTING MIGRATION"
    Test-Prerequisites
    
    if ($MigrationFile -eq "") {
        Write-Info "Available migrations:"
        $migrations = Get-ChildItem "supabase/migrations" -Name | Sort-Object -Descending
        for ($i = 0; $i -lt $migrations.Count; $i++) {
            Write-Host "  $($i + 1). $($migrations[$i])" -ForegroundColor Blue
        }
        
        $selection = Read-Host "Select migration number (or enter filename)"
        if ($selection -match '^\d+$' -and [int]$selection -le $migrations.Count) {
            $MigrationFile = $migrations[[int]$selection - 1]
        } else {
            $MigrationFile = $selection
        }
    }
    
    $migrationPath = "supabase/migrations/$MigrationFile"
    if (!(Test-Path $migrationPath)) {
        Write-Error "Migration file not found: $migrationPath"
        return
    }
    
    Write-Info "Testing migration: $MigrationFile"
    Write-Host ""
    
    # Show migration content
    Write-Info "Migration content:"
    Write-Host "----------------------------------------" -ForegroundColor DarkGray
    Get-Content $migrationPath | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    Write-Host "----------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Info "Applying migration to local database..."
    supabase db reset
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Migration applied successfully!"
        Write-Host ""
        Write-Info "Test your changes at:"
        Write-Host "- Supabase Studio: http://localhost:54323" -ForegroundColor Blue
        Write-Host "- Your app: http://localhost:3000" -ForegroundColor Blue
        Write-Host ""
        Write-Info "If everything looks good, deploy with:"
        Write-Host ".\scripts\local-dev.ps1 -Action deploy" -ForegroundColor Green
    } else {
        Write-Error "Migration failed!"
        Write-Warning "Check the error above and fix your migration"
    }
}

function Deploy-ToProduction() {
    Write-Header "DEPLOYING TO PRODUCTION"
    Test-Prerequisites
    
    Write-Warning "PRODUCTION DEPLOYMENT CHECKLIST:"
    Write-Host "  ✓ Migration tested locally?" -ForegroundColor Yellow
    Write-Host "  ✓ All features working correctly?" -ForegroundColor Yellow
    Write-Host "  ✓ No breaking changes?" -ForegroundColor Yellow
    Write-Host "  ✓ Database backup ready?" -ForegroundColor Yellow
    Write-Host ""
    
    if (!$Force) {
        $confirm = Read-Host "ALL CHECKS PASSED? Deploy to production? (yes/NO)"
        if ($confirm -ne 'yes') {
            Write-Info "Deployment cancelled - Better safe than sorry!"
            return
        }
    }
    
    Write-Info "Linking to production project..."
    supabase link --project-ref cdthersvldpnlbvpufrr
    
    Write-Info "Pushing migrations to production..."
    supabase db push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database migrations deployed successfully!"
        Write-Host ""
        Write-Info "Next: Deploy your application code"
        Write-Host "- Commit your changes: git commit -am 'feat: new feature'" -ForegroundColor Blue
        Write-Host "- Push to repo: git push origin feat/new_role" -ForegroundColor Blue
        Write-Host "- Deploy via Vercel or your deployment platform" -ForegroundColor Blue
    } else {
        Write-Error "Migration deployment failed!"
        Write-Warning "Check the error above. Production database unchanged."
    }
}

function Show-Status() {
    Write-Header "DEVELOPMENT STATUS"
    
    # Project info
    Write-Info "Project: Medical Equipment Management System"
    Write-Info "Location: $(Get-Location)"
    
    # Git status
    try {
        $gitBranch = git branch --show-current 2>$null
        Write-Info "Git Branch: $gitBranch"
    } catch {
        Write-Warning "Git not available"
    }
    
    # Docker status
    try {
        docker ps --format "table {{.Names}}\t{{.Status}}" 2>$null | Where-Object { $_ -like "*supabase*" }
        Write-Success "Docker containers running"
    } catch {
        Write-Warning "Docker not running or no Supabase containers"
    }
    
    # Recent migrations
    Write-Host ""
    Write-Info "Recent migrations:"
    $migrations = Get-ChildItem "supabase/migrations" -Name | Sort-Object -Descending | Select-Object -First 5
    foreach ($migration in $migrations) {
        Write-Host "  📄 $migration" -ForegroundColor Blue
    }
    
    # Environment files
    Write-Host ""
    Write-Info "Environment files:"
    if (Test-Path ".env.local") { Write-Host "  ✅ .env.local" -ForegroundColor Green }
    if (Test-Path ".env.local.development") { Write-Host "  ✅ .env.local.development" -ForegroundColor Green }
    if (Test-Path "supabase/config.toml") { Write-Host "  ✅ supabase/config.toml" -ForegroundColor Green }
}

# ===================================================================
# MAIN EXECUTION
# ===================================================================

switch ($Action) {
    "setup" { Setup-Environment }
    "start" { Start-Development }
    "stop" { Stop-Development }
    "reset" { Reset-Database }
    "new-migration" { New-Migration }
    "test-migration" { Test-Migration }
    "deploy" { Deploy-ToProduction }
    "status" { Show-Status }
    "help" { Show-Help }
    default { Show-Help }
}

Write-Host ""
Write-Info "For help: .\scripts\local-dev.ps1 -Action help"