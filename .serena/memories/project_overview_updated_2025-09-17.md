# Project Overview - Medical Equipment Management System (Updated September 17, 2025)

## Project Description
Vietnamese medical equipment management system ("Hệ thống quản lý thiết bị y tế") built with NextJS 15.3.3, TypeScript, and Supabase.

## Technology Stack
- **Frontend**: NextJS 15.3.3, React 18.3.1, TypeScript
- **Backend**: Supabase (@supabase/supabase-js v2.45.0)
- **Authentication**: NextAuth v4.24.11 with JWT strategy ✅
- **UI**: Radix UI components, TailwindCSS v3.4.1
- **State Management**: React Query v5.81.5 (TanStack Query)
- **Route Protection**: NextAuth middleware
- **Session Management**: JWT tokens (3-hour expiry)

## Core Features
- Equipment management (add, edit, track, transfer)
- Maintenance scheduling and management
- Repair request workflow
- User management with role-based access
- Usage tracking and analytics
- Multi-tenant architecture with department-based filtering
- Vietnamese language interface
- QR code scanning for equipment tracking
- Real-time data synchronization
- PWA support with offline capabilities

## Authentication System (CURRENT)
- **Provider**: NextAuth v4 with custom CredentialsProvider
- **Database Integration**: Supabase RPC `authenticate_user_dual_mode`
- **Session Strategy**: JWT (stateless, 3-hour expiry)
- **Multi-tenant**: JWT claims include role, department, tenant info
- **Security**: CSRF protection, failed attempt tracking, password change detection
- **Route Protection**: Middleware-based with feature flags

## User Roles
- `global` - Full system access across all tenants
- `admin` - Administrative access (legacy compatibility)
- `to_qltb` - Equipment management team
- `technician` - Technical staff with department restrictions
- `user` - Basic user access

## Multi-Tenant Architecture
- **Strategy**: No-RLS, RPC-only architecture
- **Data Isolation**: Tenant-scoped SQL RPCs using JWT claims
- **Security**: Server-side RPC gateway with whitelist validation
- **Tenant Switching**: JWT refresh on tenant change

## Database Schema
- **Users**: `nhan_vien` table with role-based access
- **Equipment**: `thiet_bi` with multi-tenant scoping
- **Tenants**: `don_vi` table for organizational units
- **Audit**: `audit_logs` for administrative actions
- **Password Security**: Dual-mode authentication (hashed + legacy)

## Development Environment
- **Package Manager**: npm (preferred over pnpm)
- **Development Server**: Next.js with Turbopack
- **Build System**: Standard Next.js build
- **Deployment**: Supports Vercel and Cloudflare Pages

## Current Status
- ✅ NextAuth migration completed (September 17, 2025)
- ✅ Multi-tenant RPC architecture implemented
- ✅ Equipment page fixes completed
- ✅ Admin password reset functionality working
- ✅ Logo and UI improvements applied
- ⏳ Transfers and Maintenance pages pending RPC migration

## Key Directories
- `src/auth/` - NextAuth configuration
- `src/app/api/auth/` - NextAuth API routes
- `src/app/api/rpc/` - Supabase RPC gateway
- `src/components/` - Reusable UI components
- `src/contexts/` - React contexts (language, realtime)
- `src/providers/` - Provider components (NextAuth session)
- `supabase/migrations/` - Database migrations

## Important Notes
- **Authentication**: Uses NextAuth v4 (NOT custom auth context)
- **Database**: Supabase with custom RPC gateway architecture
- **Multi-tenant**: JWT-based tenant isolation
- **Vietnamese UI**: Localized interface for medical staff
- **Production Ready**: Fully tested authentication and core features