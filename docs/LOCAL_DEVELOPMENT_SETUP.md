# 🏗️ LOCAL DEVELOPMENT SETUP GUIDE

## 🎯 MỤC TIÊU
Thiết lập môi trường development local để test migrations an toàn trước khi deploy lên Supabase Cloud.

## 💡 2 PHƯƠNG ÁN SETUP

### 🚀 **PHƯƠNG ÁN 1: SUPABASE LOCAL (RECOMMENDED)**

#### Yêu cầu:
- Docker Desktop
- Supabase CLI
- 4GB RAM trống

#### Lợi ích:
- ✅ Môi trường giống 100% production
- ✅ Tích hợp Auth, Storage, Realtime
- ✅ Database + APIs + Dashboard
- ✅ Migration workflow hoàn chỉnh

#### Chi phí:
- 🆓 Hoàn toàn MIỄN PHÍ
- Chỉ sử dụng tài nguyên máy local

---

### ⚡ **PHƯƠNG ÁN 2: POSTGRESQL LOCAL (SIMPLE)**

#### Yêu cầu:
- PostgreSQL
- pgAdmin (optional)

#### Lợi ích:
- ✅ Nhẹ và nhanh
- ✅ Dễ setup
- ✅ Test migration cơ bản

#### Hạn chế:
- ❌ Không có Auth/Storage
- ❌ Cần manual setup RPC functions

---

## 🛠️ SETUP INSTRUCTIONS

### **BƯỚC 1: CÀI ĐẶT DOCKER DESKTOP**

1. Tải Docker Desktop for Windows:
   ```
   https://docs.docker.com/desktop/install/windows-install/
   ```

2. Cài đặt và khởi động Docker Desktop

3. Kiểm tra:
   ```powershell
   docker --version
   docker-compose --version
   ```

### **BƯỚC 2: CÀI ĐẶT SUPABASE CLI**

#### Option A: Scoop (Recommended)
```powershell
# Cài Scoop nếu chưa có
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Cài Supabase CLI
scoop install supabase
```

#### Option B: Manual Download
1. Tải từ: https://github.com/supabase/cli/releases
2. Giải nén vào thư mục trong PATH
3. Kiểm tra: `supabase --version`

### **BƯỚC 3: KHỞI TẠO SUPABASE LOCAL**

```powershell
# Trong thư mục project
cd D:\qltbyt-nam-phong

# Khởi tạo Supabase local
supabase init

# Start local development server
supabase start
```

### **BƯỚC 4: SYNC SCHEMA TỪ PRODUCTION**

```powershell
# Link với production project
supabase link --project-ref cdthersvldpnlbvpufrr

# Pull schema từ production về local
supabase db pull

# Apply migrations lên local
supabase db reset
```

### **BƯỚC 5: CẤU HÌNH ENVIRONMENT**

Tạo file `.env.local.development`:
```env
# Local Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<local_service_key>

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-dev-secret

# Development mode
NODE_ENV=development
```

---

## 🔄 WORKFLOW DEVELOPMENT

### **QUY TRÌNH LÀM VIỆC:**

1. **💻 Develop Local:**
   ```powershell
   # Start Supabase local
   supabase start
   
   # Start Next.js với env local
   npm run dev:local
   ```

2. **🧪 Test Migration:**
   ```powershell
   # Tạo migration mới
   supabase migration new add_new_feature
   
   # Test migration local
   supabase db reset
   
   # Kiểm tra kết quả
   # http://localhost:54323 (Supabase Studio)
   ```

3. **📤 Deploy to Production:**
   ```powershell
   # Push migration lên production
   supabase db push
   
   # Deploy code
   vercel deploy --prod
   ```

---

## 🎯 SCRIPTS AUTOMATION

### **File: `scripts/dev-workflow.ps1`**

```powershell
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "reset", "new-migration", "deploy")]
    [string]$Action
)

switch ($Action) {
    "start" {
        Write-Host "🚀 Starting local development..."
        supabase start
        npm run dev
    }
    "stop" {
        Write-Host "🛑 Stopping local development..."
        supabase stop
    }
    "reset" {
        Write-Host "🔄 Resetting local database..."
        supabase db reset
    }
    "new-migration" {
        $name = Read-Host "Migration name"
        supabase migration new $name
        Write-Host "✅ Created: supabase/migrations/*_$name.sql"
    }
    "deploy" {
        Write-Host "🚀 Deploying to production..."
        supabase db push
        Write-Host "✅ Database updated!"
        Write-Host "Next: Deploy your app to Vercel"
    }
}
```

---

## 💰 SO SÁNH CHI PHÍ

| Phương án | Chi phí | Hiệu quả | Độ phức tạp |
|-----------|---------|-----------|-------------|
| Supabase Cloud Branch | ~$10/tháng | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Supabase Local** | **🆓 MIỄN PHÍ** | **⭐⭐⭐⭐** | **⭐⭐⭐** |
| PostgreSQL Local | 🆓 MIỄN PHÍ | ⭐⭐⭐ | ⭐⭐ |
| Direct Production | 🆓 nhưng RỦI RO CAO | ⭐ | ⭐ |

---

## 🎯 KHUYẾN NGHỊ

**✅ CHỌN SUPABASE LOCAL** vì:
- Hoàn toàn miễn phí
- Môi trường giống production 100%
- Workflow chuyên nghiệp
- An toàn tuyệt đối
- Tốc độ phát triển cao

**📞 SUPPORT:**
Nếu gặp khó khăn trong setup, hãy cho biết để được hỗ trợ từng bước cụ thể!