# 🚀 ONBOARDING: SETUP TRÊN MÁY MỚI

## 📋 **QUICK START** (5-10 PHÚT)

Khi bạn chuyển sang máy mới hoặc teammate khác muốn contribute, đây là quy trình siêu nhanh để setup environment:

---

## ⚡ **BƯỚC 1: CLONE PROJECT**

```bash
# Clone repository
git clone [YOUR_REPO_URL]
cd qltbyt-nam-phong

# Checkout đúng branch (nếu cần)
git checkout feat/new_role
```

---

## 🔧 **BƯỚC 2: CHẠY QUICK SETUP**

```powershell
# Chạy script setup tự động
.\scripts\quick-setup.ps1

# Hoặc bỏ qua Docker nếu không cần local Supabase
.\scripts\quick-setup.ps1 -SkipDocker
```

**Script này sẽ tự động:**
- ✅ Cài đặt dependencies (`npm install`)
- ✅ Setup environment files (`.env.local`)
- ✅ Kiểm tra Docker & Supabase CLI
- ✅ Khởi tạo Supabase config
- ✅ Chạy type check

---

## 🎯 **BƯỚC 3: KIỂM TRA SETUP**

```powershell
# Xem trạng thái hiện tại
.\scripts\local-dev.ps1 -Action status

# Test chạy TypeScript
npm run typecheck

# Test chạy development server
npm run dev
```

---

## 🐳 **BƯỚC 4: SETUP DOCKER (TÙY CHỌN)**

Nếu muốn development với Supabase local:

### **4.1: Cài Docker Desktop**
1. Tải về: https://docs.docker.com/desktop/install/windows-install/
2. Cài đặt và restart máy
3. Khởi động Docker Desktop

### **4.2: Setup Supabase Local**
```powershell
# Full setup với Docker
.\scripts\local-dev.ps1 -Action setup

# Start local development
.\scripts\local-dev.ps1 -Action start
```

---

## 📚 **TÀI LIỆU THAM KHẢO**

- 📁 `DEVOPS_WORKFLOW_SUMMARY.md` - Tổng quan workflow
- 📁 `docs/LOCAL_DEVELOPMENT_SETUP.md` - Hướng dẫn chi tiết
- 📁 `scripts/local-dev.ps1 -Action help` - Commands có sẵn

---

## 🔄 **WORKFLOW HÀNG NGÀY**

### **Development với Cloud Supabase:**
```powershell
# Start development (sử dụng production database)
npm run dev

# Tạo migration mới
# [Tạo file trong supabase/migrations/]

# Deploy migration lên production
# [Chạy trong Supabase SQL Editor]
```

### **Development với Local Supabase:**
```powershell
# Start local environment
.\scripts\local-dev.ps1 -Action start

# Tạo & test migration
.\scripts\local-dev.ps1 -Action new-migration -MigrationName feature_name
.\scripts\local-dev.ps1 -Action test-migration

# Deploy lên production khi sẵn sàng
.\scripts\local-dev.ps1 -Action deploy
```

---

## 🛠️ **TOOLS ĐÃ CÓ SẴN**

### **Scripts:**
- 🔧 `scripts/quick-setup.ps1` - Setup nhanh máy mới
- 🔧 `scripts/local-dev.ps1` - Local development workflow
- 🔧 `scripts/devops-workflow.ps1` - Legacy DevOps commands

### **Environment:**
- 🔧 `.env.local.development` - Template cho local development
- 🔧 `supabase/config.toml` - Supabase local configuration

### **Documentation:**
- 📚 `DEVOPS_WORKFLOW_SUMMARY.md`
- 📚 `docs/LOCAL_DEVELOPMENT_SETUP.md`
- 📚 `ONBOARDING_NEW_MACHINE.md` (file này)

---

## ⚠️ **LƯU Ý QUAN TRỌNG**

### **Environment Variables:**
- ✅ `.env.local.development` được commit (template)
- ❌ `.env.local` KHÔNG được commit (chứa keys thật)
- ⚡ Script tự động copy template thành `.env.local`

### **Supabase Local:**
- 🆓 Hoàn toàn miễn phí
- 🛡️ An toàn 100% cho testing
- 🔧 Không ảnh hưởng production

### **Production Database:**
- ⚠️ CHỈ deploy migrations đã test kỹ
- 🛡️ Luôn backup trước khi deploy
- 📋 Follow checklist trong script deploy

---

## 🆘 **TROUBLESHOOTING**

### **Lỗi phổ biến:**

#### **1. "npm install failed"**
```powershell
# Clear cache và thử lại
npm cache clean --force
rm -rf node_modules
npm install
```

#### **2. "Docker not found"**
```powershell
# Bỏ qua Docker trong setup
.\scripts\quick-setup.ps1 -SkipDocker
```

#### **3. "TypeScript errors"**
```powershell
# Chạy type check để xem lỗi cụ thể
npm run typecheck
```

#### **4. "Supabase CLI not found"**
```powershell
# Cài thủ công qua Scoop
scoop install supabase

# Hoặc download từ GitHub
# https://github.com/supabase/cli/releases
```

---

## 🎯 **SUCCESS CRITERIA**

Sau khi setup thành công, bạn sẽ có thể:

✅ Chạy `npm run dev` không lỗi  
✅ Chạy `npm run typecheck` pass  
✅ Truy cập http://localhost:3000 hiển thị app  
✅ Login vào system thành công  
✅ Scripts workflow hoạt động đúng  

---

## 🏆 **CHÚC MỪNG!**

🎉 Bạn đã setup thành công development environment!

**Next steps:**
1. Đọc code để hiểu project structure
2. Tạo feature branch cho task mới
3. Follow quy trình development đã thiết lập

**Need help?** Liên hệ team hoặc check documentation trong `docs/`

---

*Last updated: September 26, 2025*  
*Project: Medical Equipment Management System - QLTBYT Nam Phong*