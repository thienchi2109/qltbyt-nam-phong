# Device Quota Management - Implementation Plan

> **Source of Truth:** Database schema lives in migration files. This document provides implementation guidance.

**Goal:** Equipment quota management per Circular 08/2019/TT-BYT with split-screen mapping interface, AI suggestions, and compliance reports.

---

## Schema Reference

**Authoritative Source:** `supabase/migrations/20260131_device_quota_schema.sql`

### Tables

| Table | Purpose |
|-------|---------|
| `nhom_thiet_bi` | Equipment categories (standalone, reusable across decisions) |
| `quyet_dinh_dinh_muc` | Quota decision documents |
| `chi_tiet_dinh_muc` | Links decisions to categories with min/max quantities |
| `thiet_bi.nhom_thiet_bi_id` | Equipment → Category mapping |
| `thiet_bi_nhom_audit_log` | Audit trail for link/unlink operations |
| `lich_su_dinh_muc` | Decision lifecycle audit log |

### Key Design Decisions

1. **Normalized Categories**: `nhom_thiet_bi` is tenant-scoped but independent of decisions, allowing categories to be reused across multiple quota decisions
2. **Quota Line Items**: `chi_tiet_dinh_muc` joins decisions to categories with specific limits
3. **Cross-tenant Triggers**: Prevent linking entities from different facilities
4. **Append-only Audits**: Both audit tables block UPDATE/DELETE via PostgreSQL rules

---

## Authorization Matrix

| Action | `global` | `to_qltb` | Others |
|--------|:--------:|:---------:|:------:|
| View all pages | ✅ | ✅ | ✅ (read-only) |
| Link/Unlink equipment | ✅ | ✅ | ❌ |
| AI suggestion | ✅ | ✅ | ❌ |
| Create/Edit decisions | ✅ | ✅ | ❌ |
| Export HTML report | ✅ | ✅ | ✅ |

---

## Phase 1: Database Schema ✅ COMPLETE

- [x] Create schema migration with tables, triggers, constraints
- [x] Add security fixes (CHECK constraints, cross-tenant triggers, FK refs)

**Commit:** `3738b66 feat(db): add device quota schema with security constraints`

---

## Phase 2: RPC Functions

### Task 2.1: Quota Decision RPC Functions

**File:** `supabase/migrations/20260201_device_quota_rpc_decisions.sql`

| Function | Purpose |
|----------|---------|
| `dinh_muc_quyet_dinh_list` | List decisions for tenant with counts |
| `dinh_muc_quyet_dinh_get` | Get single decision with line items |
| `dinh_muc_quyet_dinh_create` | Create draft decision |
| `dinh_muc_quyet_dinh_update` | Update draft decision |
| `dinh_muc_quyet_dinh_activate` | Publish decision (draft → active) |
| `dinh_muc_quyet_dinh_delete` | Delete draft decision |

### Task 2.2: Category RPC Functions

**File:** `supabase/migrations/20260201_device_quota_rpc_categories.sql`

| Function | Purpose |
|----------|---------|
| `dinh_muc_nhom_list` | List categories with hierarchy (recursive CTE) |
| `dinh_muc_nhom_upsert` | Create/update category |
| `dinh_muc_nhom_delete` | Delete category (check for linked equipment) |

### Task 2.3: Equipment Mapping RPC Functions

**File:** `supabase/migrations/20260201_device_quota_rpc_mapping.sql`

| Function | Purpose |
|----------|---------|
| `dinh_muc_thiet_bi_link` | Bulk link equipment to category |
| `dinh_muc_thiet_bi_unlink` | Bulk unlink equipment |
| `dinh_muc_thiet_bi_unassigned` | List unmapped equipment with search |
| `dinh_muc_thiet_bi_by_nhom` | List equipment in a category |

### Task 2.4: Quota Line Items RPC Functions

**File:** `supabase/migrations/20260201_device_quota_rpc_line_items.sql`

| Function | Purpose |
|----------|---------|
| `dinh_muc_chi_tiet_list` | List line items for a decision |
| `dinh_muc_chi_tiet_upsert` | Add/update quota line item |
| `dinh_muc_chi_tiet_delete` | Remove quota line item |

### Task 2.5: Compliance & Reporting RPC Functions

**File:** `supabase/migrations/20260201_device_quota_rpc_compliance.sql`

| Function | Purpose |
|----------|---------|
| `dinh_muc_compliance_summary` | Dashboard stats (đạt/thiếu/vượt counts) |
| `dinh_muc_compliance_detail` | Per-category compliance status |

### Task 2.6: Update RPC Whitelist

**File:** `src/app/api/rpc/[fn]/route.ts`

Add all new `dinh_muc_*` functions to `ALLOWED_FUNCTIONS` array.

### Task 2.7: Regenerate TypeScript Types

```bash
node scripts/npm-run.js run db:types
```

---

## Phase 3: Frontend - Navigation & Layout

### Task 3.1: Add Navigation Section

**Files:**
- `src/components/layout/sidebar-nav.tsx`
- `src/config/navigation.ts`

Add "Định mức" section with sub-items: Dashboard, Mapping, Decisions

### Task 3.2: Create Route Group

**Files:**
- `src/app/(app)/device-quota/layout.tsx`
- `src/app/(app)/device-quota/page.tsx` (redirect to dashboard)
- `src/app/(app)/device-quota/dashboard/page.tsx`
- `src/app/(app)/device-quota/mapping/page.tsx`
- `src/app/(app)/device-quota/decisions/page.tsx`

---

## Phase 4: Frontend - Dashboard Page

### Task 4.1: Compliance Summary Cards

Display đạt/thiếu/vượt counts with color-coded badges.

### Task 4.2: Unassigned Equipment Alert

Show count of equipment not linked to any category.

---

## Phase 5: Frontend - Mapping Interface

### Task 5.1: Split-Screen Layout

Left panel: Unmapped equipment list with search
Right panel: Category tree with current counts

### Task 5.2: Drag-and-Drop or Selection-Based Mapping

Bulk select equipment → assign to category

### Task 5.3: AI Suggestion Integration

Gemini API for smart category suggestions based on equipment name/model

---

## Phase 6: Frontend - Decisions Management

### Task 6.1: Decisions List Page

Table of quota decisions with status badges

### Task 6.2: Decision Create/Edit Dialog

Form for decision metadata + line items editor

### Task 6.3: Excel Import for Line Items

Bulk import quota line items from spreadsheet

---

## Phase 7: Reports

### Task 7.1: HTML Compliance Report

Printable report with signature block per Circular 46/2025/TT-BYT

---

## Future (Phase 2 Scope)

- Quota enforcement at Equipment Add/Import/Transfer
- Automated expiry notifications
- Historical compliance trends

---

## Archived

See `docs/device-quota/archive/` for original planning document.
