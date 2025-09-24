# QLTBYT Nam Phong - Current Status (January 2025)

## Project Overview
Medical Equipment Management System for Vietnamese healthcare institutions with complete multi-tenant architecture.

**Tech Stack:**
- Frontend: Next.js 15 (App Router), TypeScript, Tailwind CSS, Radix UI
- Backend: Supabase Postgres with RPC-only architecture (no RLS)
- Auth: NextAuth v4 with JWT strategy
- Deployment: Dual target (Vercel + Cloudflare Pages)

## Architecture Status: ✅ COMPLETE

### Multi-Tenant RPC Architecture
- **Strategy**: No-RLS, RPC-only with server-side tenant enforcement
- **Security**: JWT-signed RPC gateway with claims validation
- **Data Isolation**: Tenant-scoped SQL RPCs using `_get_jwt_claim()`
- **Performance**: Optimized indexes and server-side pagination

### Authentication System
- **Provider**: NextAuth v4 with custom CredentialsProvider
- **Database Integration**: `authenticate_user_dual_mode` RPC
- **Session Strategy**: JWT (3-hour expiry) with tenant claims
- **Security**: CSRF protection, rate limiting, password change detection

## Module Implementation Status

### ✅ Equipment Management (COMPLETE)
- **Features**: Full CRUD, QR codes, bulk import, tenant filtering
- **RPC Coverage**: `equipment_list_enhanced`, `equipment_create/update/delete`
- **UI Enhancements**: Global/admin fetch gating, persistent tenant selection
- **Performance**: Server-side pagination, optimized queries
- **Status**: Production ready

### ✅ Maintenance System (COMPLETE)  
- **Features**: Plans, tasks, approvals, scheduling
- **RPC Coverage**: All maintenance operations via RPCs
- **Integration**: Equipment linking, user assignment
- **Status**: Production ready

### ✅ Transfer Requests (COMPLETE)
- **Features**: Internal/external transfers, approval workflow
- **RPC Coverage**: Complete RPC migration finished
- **Integration**: Department management, history tracking  
- **Status**: Production ready

### ✅ Reports & Analytics (COMPLETE - Latest: 2025-09-23)
- **Features**: Excel export, status distribution, maintenance stats
- **RPC Coverage**: `equipment_status_distribution`, `maintenance_stats_for_reports`
- **Export**: 7 comprehensive Excel sheets with dynamic imports
- **Tenant Support**: Full tenant/department filtering
- **Status**: Production ready with latest enhancements

### ✅ User & Tenant Management (COMPLETE)
- **Features**: Role-based access, tenant switching, membership management
- **RPC Coverage**: `user_create`, `tenant_list`, `user_membership_*`
- **UI**: Integrated tenant switcher, user management interface
- **Status**: Production ready

## Current User Roles
- `global` - Full system access across all tenants
- `to_qltb` - Equipment management team  
- `technician` - Technical staff with department restrictions
- `user` - Basic user access
- `admin` - Legacy compatibility (mapped to global)

## Key Technical Implementations

### RPC Gateway (`src/app/api/rpc/[fn]/route.ts`)
- Whitelist validation for all allowed functions
- JWT signing with claims: `app_role`, `don_vi`, `user_id`
- Secure proxy to PostgREST with tenant enforcement

### Database Schema
- **Core Tables**: `nhan_vien`, `don_vi`, `thiet_bi`, `yeu_cau_sua_chua`
- **Multi-tenant**: `don_vi` table with tenant isolation
- **Performance**: Optimized indexes for common queries
- **Security**: SECURITY DEFINER RPCs only, no direct table access

### Frontend Patterns
- TanStack Query for caching with tenant-scoped keys
- Server-side pagination and filtering
- Optimistic updates with rollback
- Tenant-aware cache invalidation

## Build & Deployment

### Development
```bash
npm run dev          # Development server (Turbopack)
npm run dev-https    # HTTPS development (port 9002)
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
```

### Production
```bash
npm run build                # Standard Next.js build
npm run build:cloudflare     # Cloudflare Workers build
npm run deploy:dual          # Deploy to both Vercel & Cloudflare
```

## Database Migrations Status
- **Phase 1**: Multi-tenant schema ✅ Complete
- **Equipment RPCs**: All operations ✅ Complete  
- **Maintenance RPCs**: Full coverage ✅ Complete
- **Transfer RPCs**: Complete migration ✅ Complete
- **Reports RPCs**: Enhanced with exports ✅ Complete (2025-09-23)
- **User/Tenant RPCs**: Management functions ✅ Complete

## Performance Optimizations
- Server-side pagination across all modules
- Optimized database indexes
- Tenant-scoped caching strategies
- Global/admin fetch gating to reduce initial queries
- AbortSignal support for request deduplication

## Security Features
- No-RLS architecture with RPC-only access
- JWT-based tenant isolation
- Role-based access control at SQL level
- CSRF protection and rate limiting
- Secure password handling (dual-mode support)

## PWA & Mobile Support
- Service worker registration
- Offline capability
- Mobile-responsive design
- QR code scanning for equipment

## Recent Enhancements (Latest)
- **2025-09-23**: Complete Excel export with 7 comprehensive sheets
- **2025-09-21**: Reports tenant filtering and server-side department filtering  
- **2025-09-20**: Equipment fetch gating for global/admin users
- **2025-09-17**: Enhanced pagination and performance optimizations

## Development Environment
- **OS**: Windows (PowerShell)
- **Package Manager**: npm (preferred)
- **Repository**: D:\qltbyt-nam-phong
- **IDE**: VS Code with TypeScript support

## Current Production Readiness: ✅ FULLY READY
All core modules are complete with RPC coverage, proper tenant isolation, and production-grade performance optimizations. The system is ready for deployment with comprehensive testing across all user roles and tenant scenarios.

## Next Phase Opportunities (Optional)
- Device quota compliance tracking (plan documented)
- Advanced analytics dashboards
- Mobile app deployment
- Additional export formats (PDF reports)
- Advanced audit logging

---
*Status Updated: January 2025*
*Architecture: Multi-tenant RPC-only (No-RLS)*
*Framework: Next.js 15 + Supabase + NextAuth*