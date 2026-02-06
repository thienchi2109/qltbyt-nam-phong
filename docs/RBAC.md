# Role-Based Access Control (RBAC) System

## Overview

This system uses an **RPC-Proxy Security Model** where all database access goes through signed JWT claims. Security is enforced at two levels:

1. **API Proxy Layer** (`/api/rpc/[fn]`) - Validates session, signs JWT with trusted claims
2. **PostgreSQL RPC Functions** - Read JWT claims and enforce data boundaries

```
Client → callRpc() → /api/rpc/[fn] → Supabase PostgREST → RPC Function
```

---

## Role Hierarchy (6 Supported Roles)

```
                           ┌─────────────────┐
                           │     GLOBAL      │
                           │  (Admin/Super)  │
                           │ System-wide     │
                           └────────┬────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
           ┌────────▼────────┐             ┌────────▼────────┐
           │ REGIONAL_LEADER │             │     TO_QLTB     │
           │  (Sở/Vùng)      │             │ (Equipment Team)│
           │ Multi-tenant RO │             │ Single Tenant   │
           └────────┬────────┘             └────────┬────────┘
                    │                               │
                    │                    ┌──────────┴──────────┐
                    │                    │                     │
                    │           ┌────────▼────────┐   ┌────────▼────────┐
                    │           │   TECHNICIAN    │   │    QLTB_KHOA    │
                    │           │  (Kỹ thuật viên)│   │ (Dept Equipment)│
                    │           │ Tenant + Dept   │   │ Tenant + Dept   │
                    │           └────────┬────────┘   └────────┬────────┘
                    │                    │                     │
                    └────────────────────┼─────────────────────┘
                                         │
                                ┌────────▼────────┐
                                │      USER       │
                                │   (Nhân viên)   │
                                │ Single Tenant   │
                                └─────────────────┘
```

---

## Role Definitions

| Role Code | Vietnamese Name | Scope | Access Level |
|-----------|-----------------|-------|--------------|
| `global` | Quản trị hệ thống | **System-wide** | Full read/write to all tenants and regions |
| `regional_leader` | Lãnh đạo Sở/Vùng | **Region** | **Read-only** multi-tenant within assigned `dia_ban_id` |
| `to_qltb` | Tổ/Phòng VT-TBYT | **Tenant** | Full equipment management within their `don_vi` |
| `technician` | Kỹ thuật viên | **Tenant + Dept** | Equipment ops within tenant, restricted to assigned `khoa_phong` |
| `qltb_khoa` | QLTB Khoa/Phòng | **Tenant + Dept** | Department equipment management within assigned `khoa_phong` |
| `user` | Nhân viên | **Tenant** | Basic read access within their `don_vi` |

> **Note:** `admin` is a legacy alias normalized to `global` at runtime.

---

## Permission Matrix

### Equipment Operations

| Operation | global | regional_leader | to_qltb | technician | qltb_khoa | user |
|-----------|:------:|:---------------:|:-------:|:----------:|:---------:|:----:|
| List (all tenants) | ✅ | ✅ (region) | ❌ | ❌ | ❌ | ❌ |
| List (own tenant) | ✅ | ✅ | ✅ | ✅ | ✅ (dept) | ✅ |
| View details | ✅ | ✅ | ✅ | ✅ | ✅ (dept) | ✅ |
| Create | ✅ | ❌ | ✅ | ✅ (dept) | ❌ | ❌ |
| Update | ✅ | ❌ | ✅ | ✅ (dept) | ❌ | ❌ |
| Delete | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bulk import | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

### Repair Requests

| Operation | global | regional_leader | to_qltb | technician | qltb_khoa | user |
|-----------|:------:|:---------------:|:-------:|:----------:|:---------:|:----:|
| List | ✅ | ✅ (region) | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Approve | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Complete | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

### Transfer Requests

| Operation | global | regional_leader | to_qltb | technician | qltb_khoa | user |
|-----------|:------:|:---------------:|:-------:|:----------:|:---------:|:----:|
| List | ✅ | ✅ (region, RO) | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ✅ | ✅ | ✅ (dept) | ❌ |
| Update status | ✅ | ❌ | ✅ | ✅ | ✅ (dept) | ❌ |
| Approve | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Complete | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

### Maintenance Plans

| Operation | global | regional_leader | to_qltb | technician | qltb_khoa | user |
|-----------|:------:|:---------------:|:-------:|:----------:|:---------:|:----:|
| List | ✅ | ✅ (region) | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Update | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Approve/Reject | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Complete task | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |

### Usage Logs

| Operation | global | regional_leader | to_qltb | technician | qltb_khoa | user |
|-----------|:------:|:---------------:|:-------:|:----------:|:---------:|:----:|
| List | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own) |
| Start session | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ (own) |
| End session | ✅ | ❌ | ✅ | ✅ | ✅ (own) | ✅ (own) |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Administration

| Operation | global | regional_leader | to_qltb | technician | qltb_khoa | user |
|-----------|:------:|:---------------:|:-------:|:----------:|:---------:|:----:|
| User management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tenant (don_vi) CRUD | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Audit logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View all facilities | ✅ | ✅ (region) | ❌ | ❌ | ❌ | ❌ |

---

## Frontend Utility Functions

Frontend role checks are centralized in `src/lib/rbac.ts` to keep UI logic consistent and avoid duplication.

Available helpers:
- `ROLES` (typed role constants)
- `isGlobalRole()` (global/admin)
- `isRegionalLeaderRole()`
- `isEquipmentManagerRole()` (global/admin/to_qltb)
- `isDeptScopedRole()` (technician/qltb_khoa)
- `isPrivilegedRole()` (re-export from `src/types/tenant.ts`)

**Security note:** These helpers control **UI visibility only**. All permission enforcement remains server-side via the API proxy and PostgreSQL RPC functions.

---

## Tenant Isolation Rules

### API Proxy Enforcement (`/api/rpc/[fn]`)

```typescript
// For non-global and non-regional_leader users, p_don_vi is FORCED
if (appRole !== 'global' && appRole !== 'regional_leader') {
  body.p_don_vi = userDonVi;  // Client cannot override
}
```

### RPC Function Pattern

```sql
-- Standard permission + isolation check
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
BEGIN
  -- 1. Permission check
  IF v_role NOT IN ('global', 'to_qltb', 'technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- 2. Tenant isolation
  IF v_role NOT IN ('global', 'regional_leader') THEN
    p_don_vi := v_don_vi;  -- Force user's tenant
  END IF;

  -- 3. Department restriction (for technician/qltb_khoa)
  IF v_role = 'technician' THEN
    PERFORM 1 FROM nhan_vien
    WHERE id = v_user_id AND khoa_phong = v_target_dept;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Department mismatch';
    END IF;
  END IF;
END;
```

---

## Scope Definitions

| Scope | Filtering Clause | Roles Applied |
|-------|------------------|---------------|
| **System-wide** | No filter | `global` |
| **Regional** | `WHERE dia_ban_id = :user_dia_ban` | `regional_leader` |
| **Tenant** | `WHERE don_vi_id = :user_don_vi` | `to_qltb`, `technician`, `qltb_khoa`, `user` |
| **Department** | `WHERE don_vi_id = :user_don_vi AND khoa_phong = :user_khoa_phong` | `technician`, `qltb_khoa` |

---

## User Session Claims (JWT)

```typescript
interface JWTClaims {
  role: 'authenticated';           // Supabase role
  sub: string;                     // User ID (for auth.uid())
  app_role: UserRole;              // Application role
  don_vi: string | null;           // Tenant ID
  dia_ban: string | null;          // Region ID (for regional_leader)
  user_id: string;                 // User ID
}
```

---

## Database Schema (nhan_vien)

```sql
CREATE TABLE nhan_vien (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN (
    'admin', 'global', 'to_qltb', 'qltb_khoa', 'technician', 'user', 'regional_leader'
  )),
  don_vi INTEGER REFERENCES don_vi(id),        -- Tenant assignment
  dia_ban_id INTEGER REFERENCES dia_ban(id),   -- Region (for regional_leader)
  khoa_phong VARCHAR(100),                     -- Department (for dept-scoped roles)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TypeScript Types

```typescript
// src/types/database.ts
export const USER_ROLES = {
  global: 'Quản trị hệ thống',
  regional_leader: 'Lãnh đạo Sở/Vùng',
  to_qltb: 'Tổ/Phòng VT-TBYT',
  technician: 'Kỹ thuật viên',
  qltb_khoa: 'QLTB của Khoa/Phòng',
  user: 'Nhân viên',
  admin: 'Quản trị hệ thống',  // Legacy alias
} as const;

export type UserRole = keyof typeof USER_ROLES;

export interface SessionUser {
  id: string | number;
  role: string;
  khoa_phong: string | null;
  username?: string;
  don_vi?: number | string;
  dia_ban_id?: number;
  full_name?: string;
}
```

---

## Frontend Permission Checks

```typescript
// Common patterns
const isGlobal = role === 'global' || role === 'admin';
const isRegionalLeader = role === 'regional_leader';
const isTransferCoreRole = isGlobal || role === 'to_qltb';
const canManageEquipment = ['global', 'to_qltb', 'technician'].includes(role);
const isDeptScoped = ['technician', 'qltb_khoa'].includes(role);
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/api/rpc/[fn]/route.ts` | Security gateway, JWT signing, tenant enforcement |
| `src/lib/rpc-client.ts` | Client `callRpc()` wrapper |
| `src/types/database.ts` | Role definitions and types |
| `src/auth/config.ts` | NextAuth configuration |
| `supabase/migrations/` | RPC functions with permission checks |

---

## Role Assignment Quick Reference

| Role | Assigned To | Key Restrictions |
|------|-------------|------------------|
| `global` | System administrators | None - full access |
| `regional_leader` | Health department officials | Read-only, regional scope |
| `to_qltb` | Hospital equipment teams | Full ops within tenant |
| `technician` | Technical staff | Limited to assigned department |
| `qltb_khoa` | Department equipment managers | Department scope only |
| `user` | General staff | Basic read access |
