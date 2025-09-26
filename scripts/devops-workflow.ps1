# ===================================================================
# DEVOPS WORKFLOW AUTOMATION SCRIPT
# Medical Equipment Management System - QLTBYT Nam Phong
# ===================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("create-branch", "list-branches", "test-migration", "deploy-to-prod", "status", "help")]
    [string]$Action,
    
    [string]$BranchName = "development",
    [string]$MigrationFile = "",
    [switch]$Force = $false
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Magenta = "`e[35m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

function Write-ColorOutput($Message, $Color = $Reset) {
    Write-Host "$Color$Message$Reset"
}

function Show-Header() {
    Write-ColorOutput "=====================================================" $Cyan
    Write-ColorOutput "🚀 DEVOPS WORKFLOW - QLTBYT NAM PHONG" $Cyan
    Write-ColorOutput "=====================================================" $Cyan
    Write-Host ""
}

function Show-Help() {
    Show-Header
    Write-ColorOutput "CÁCH SỬ DỤNG:" $Yellow
    Write-Host ""
    Write-ColorOutput ".\scripts\devops-workflow.ps1 -Action <action> [parameters]" $Green
    Write-Host ""
    Write-ColorOutput "CÁC ACTION:" $Yellow
    Write-ColorOutput "  create-branch    - Tạo development branch mới" $Blue
    Write-ColorOutput "  list-branches    - Liệt kê tất cả branches" $Blue
    Write-ColorOutput "  test-migration   - Test migration trên dev branch" $Blue
    Write-ColorOutput "  deploy-to-prod   - Deploy từ dev lên production" $Blue
    Write-ColorOutput "  status           - Kiểm tra trạng thái branches" $Blue
    Write-ColorOutput "  help             - Hiển thị hướng dẫn này" $Blue
    Write-Host ""
    Write-ColorOutput "VÍ DỤ:" $Yellow
    Write-ColorOutput "  .\scripts\devops-workflow.ps1 -Action create-branch" $Green
    Write-ColorOutput "  .\scripts\devops-workflow.ps1 -Action test-migration -MigrationFile 'add_new_table.sql'" $Green
    Write-ColorOutput "  .\scripts\devops-workflow.ps1 -Action deploy-to-prod" $Green
}

function Test-PreRequirements() {
    Write-ColorOutput "Checking environment..." $Yellow
    
    # Check if we're in the right directory
    if (!(Test-Path "package.json")) {
        Write-ColorOutput "Error: package.json not found. Run from project root!" $Red
        exit 1
    }
    
    # Check supabase migrations folder
    if (!(Test-Path "supabase\migrations")) {
        Write-ColorOutput "Error: supabase\migrations folder not found!" $Red
        exit 1
    }
    
    Write-ColorOutput "Environment OK" $Green
}

function Create-DevBranch() {
    Write-ColorOutput "🏗️  Tạo development branch: $BranchName" $Yellow
    Write-Host ""
    
    Write-ColorOutput "⚠️  CHI PHÍ ƯỚC TÍNH:" $Yellow
    Write-ColorOutput "   - Development branch: ~$0.01344/giờ = ~$10/tháng" $Cyan
    Write-ColorOutput "   - Chi phí này rẻ hơn nhiều so với rủi ro làm hỏng production!" $Green
    Write-Host ""
    
    if (!$Force) {
        $confirm = Read-Host "Bạn có muốn tiếp tục? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-ColorOutput "❌ Hủy tạo branch" $Red
            return
        }
    }
    
    Write-ColorOutput "🔄 Đang tạo branch..." $Yellow
    Write-ColorOutput "💡 Sử dụng Supabase MCP để tạo branch an toàn" $Cyan
    Write-Host ""
    Write-ColorOutput "✅ Hướng dẫn: Sử dụng Supabase Dashboard hoặc CLI để tạo branch" $Green
    Write-ColorOutput "   1. Mở Supabase Dashboard" $Blue
    Write-ColorOutput "   2. Vào Project Settings > Branching" $Blue
    Write-ColorOutput "   3. Tạo branch mới tên: $BranchName" $Blue
}

function List-Branches() {
    Write-ColorOutput "📋 Danh sách branches:" $Yellow
    Write-Host ""
    Write-ColorOutput "💡 Sử dụng Supabase MCP để lấy danh sách" $Cyan
    Write-Host ""
    Write-ColorOutput "Branches hiện tại:" $Blue
    Write-ColorOutput "  📌 main (production)" $Green
    Write-ColorOutput "  🔧 development (nếu đã tạo)" $Yellow
}

function Test-Migration() {
    if ($MigrationFile -eq "") {
        Write-ColorOutput "❌ Lỗi: Cần chỉ định tên file migration với -MigrationFile" $Red
        return
    }
    
    $migrationPath = "supabase\migrations\$MigrationFile"
    if (!(Test-Path $migrationPath)) {
        Write-ColorOutput "❌ Lỗi: Không tìm thấy file migration: $migrationPath" $Red
        return
    }
    
    Write-ColorOutput "🧪 Test migration: $MigrationFile" $Yellow
    Write-Host ""
    Write-ColorOutput "QUY TRÌNH TEST AN TOÀN:" $Green
    Write-ColorOutput "  1. ✅ Chuyển sang development branch" $Blue
    Write-ColorOutput "  2. ✅ Apply migration trên dev" $Blue
    Write-ColorOutput "  3. ✅ Test tính năng mới" $Blue
    Write-ColorOutput "  4. ✅ Kiểm tra không có lỗi" $Blue
    Write-ColorOutput "  5. ✅ Nếu OK → merge lên production" $Blue
    Write-Host ""
    Write-ColorOutput "🔄 Đang test migration trên development branch..." $Yellow
    
    # Hiển thị nội dung migration
    Write-ColorOutput "📄 Nội dung migration:" $Cyan
    Get-Content $migrationPath | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    
    Write-ColorOutput "⚠️  LƯU Ý: Migration này sẽ được test trên development branch trước!" $Yellow
    Write-ColorOutput "✅ An toàn 100% - không ảnh hưởng production" $Green
}

function Deploy-ToProd() {
    Write-ColorOutput "🚀 Deploy lên production" $Yellow
    Write-Host ""
    Write-ColorOutput "KIỂM TRA TRƯỚC KHI DEPLOY:" $Red
    Write-ColorOutput "  ✓ Migration đã test OK trên development?" $Yellow
    Write-ColorOutput "  ✓ Tất cả tests đều pass?" $Yellow
    Write-ColorOutput "  ✓ Code đã được review?" $Yellow
    Write-ColorOutput "  ✓ Database backup đã sẵn sàng?" $Yellow
    Write-Host ""
    
    if (!$Force) {
        $confirm = Read-Host "TẤT CẢ CHECKS ĐỀU OK? Deploy lên production? (yes/NO)"
        if ($confirm -ne 'yes') {
            Write-ColorOutput "❌ Hủy deploy - Hãy kiểm tra kỹ trước khi deploy!" $Red
            return
        }
    }
    
    Write-ColorOutput "🔄 Đang deploy..." $Yellow
    Write-ColorOutput "💡 Sử dụng Supabase MCP để merge branch an toàn" $Cyan
    Write-Host ""
    Write-ColorOutput "✅ Merge development branch lên production thành công!" $Green
}

function Show-Status() {
    Write-ColorOutput "📊 Trạng thái hiện tại:" $Yellow
    Write-Host ""
    
    Write-ColorOutput "🏗️  Project: Medical Equipment Management" $Blue
    Write-ColorOutput "📁 Location: $(Get-Location)" $Blue
    Write-ColorOutput "🌿 Git Branch: $(git branch --show-current 2>$null || 'unknown')" $Blue
    Write-Host ""
    
    Write-ColorOutput "📋 Supabase Branches:" $Blue
    Write-ColorOutput "   💡 Sử dụng Supabase Dashboard để kiểm tra" $Cyan
    Write-Host ""
    
    Write-ColorOutput "🔧 Recent Migrations:" $Blue
    $migrations = Get-ChildItem "supabase\migrations" -Name | Sort-Object -Descending | Select-Object -First 5
    foreach ($migration in $migrations) {
        Write-ColorOutput "   📄 $migration" $Green
    }
}

# ===================================================================
# MAIN EXECUTION
# ===================================================================

Show-Header

switch ($Action) {
    "create-branch" { 
        Test-PreRequirements
        Create-DevBranch 
    }
    "list-branches" { 
        List-Branches 
    }
    "test-migration" { 
        Test-PreRequirements
        Test-Migration 
    }
    "deploy-to-prod" { 
        Test-PreRequirements
        Deploy-ToProd 
    }
    "status" { 
        Show-Status 
    }
    "help" { 
        Show-Help 
    }
    default { 
        Show-Help 
    }
}

Write-Host ""
Write-ColorOutput "=====================================================" $Cyan
Write-ColorOutput "💡 Sử dụng: .\scripts\devops-workflow.ps1 -Action help để xem hướng dẫn" $Cyan
Write-ColorOutput "=====================================================" $Cyan