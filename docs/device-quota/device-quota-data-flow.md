# Device Quota Feature - Data Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  QuotaDecisions  │  │  QuotaDetails    │  │  Compliance      │           │
│  │  Page            │  │  TreeTable       │  │  Dashboard       │           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │                     │                     │                      │
│           ▼                     ▼                     ▼                      │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    TanStack Query Hooks                          │        │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │        │
│  │  │useQuyetDinhList │ │useChiTietList   │ │useComplianceRpt │    │        │
│  │  │useCreateQuyetDinh│ │useUpsertChiTiet │ │                 │    │        │
│  │  │useActivate      │ │                 │ │                 │    │        │
│  │  │usePublish       │ │                 │ │                 │    │        │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘    │        │
│  └────────────────────────────────┬────────────────────────────────┘        │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                      callRpc() - RPC Client                      │        │
│  │                      src/lib/rpc-client.ts                       │        │
│  └────────────────────────────────┬────────────────────────────────┘        │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ HTTP POST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Security Gateway)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │              /api/rpc/[fn]/route.ts                              │        │
│  │                                                                  │        │
│  │  1. Validate session (NextAuth)                                  │        │
│  │  2. Check function in ALLOWED_FUNCTIONS whitelist                │        │
│  │  3. Override p_don_vi for non-global users ← CRITICAL SECURITY   │        │
│  │  4. Sign JWT with claims:                                        │        │
│  │     { app_role, don_vi, user_id, dia_ban_id }                   │        │
│  │  5. Forward to Supabase PostgREST                               │        │
│  │                                                                  │        │
│  └────────────────────────────────┬────────────────────────────────┘        │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ JWT-signed request
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (PostgreSQL + PostgREST)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    RPC Functions (SECURITY DEFINER)              │        │
│  │                                                                  │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  Extract JWT Claims:                                     │    │        │
│  │  │  v_role := current_setting('request.jwt.claims')::json   │    │        │
│  │  │            ->>'app_role'                                 │    │        │
│  │  │  v_don_vi := ... ->>'don_vi'                            │    │        │
│  │  │  v_user_id := ... ->>'user_id'                          │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                                                                  │        │
│  │  ┌───────────────────┐  ┌───────────────────┐                   │        │
│  │  │dinh_muc_quyet_dinh│  │dinh_muc_chi_tiet  │                   │        │
│  │  │_list/_create/     │  │_list/_upsert      │                   │        │
│  │  │_activate/_publish │  │                   │                   │        │
│  │  └─────────┬─────────┘  └─────────┬─────────┘                   │        │
│  │            │                      │                              │        │
│  │            ▼                      ▼                              │        │
│  │  ┌───────────────────────────────────────────────────────────┐  │        │
│  │  │              Tenant Isolation Enforcement                  │  │        │
│  │  │  IF v_role NOT IN ('global','admin') THEN                 │  │        │
│  │  │     p_don_vi := v_don_vi;  -- Force user's tenant         │  │        │
│  │  │  END IF;                                                   │  │        │
│  │  └───────────────────────────────────────────────────────────┘  │        │
│  │                                                                  │        │
│  └────────────────────────────────┬────────────────────────────────┘        │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                         DATABASE TABLES                          │        │
│  │                                                                  │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  nhom_thiet_bi_dinh_muc (Equipment Categories)           │    │        │
│  │  │  ├── Global hierarchy (shared across all tenants)        │    │        │
│  │  │  ├── ltree path for fast tree queries                    │    │        │
│  │  │  └── I → A → 1 → a structure                             │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                           ▲                                      │        │
│  │                           │ references                           │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  quyet_dinh_dinh_muc (Quota Decisions)                   │    │        │
│  │  │  ├── Per-tenant (don_vi_id)                              │    │        │
│  │  │  ├── Version control (phien_ban, thay_the_cho_id)        │    │        │
│  │  │  ├── Status: draft → active → replaced                   │    │        │
│  │  │  └── Immutability trigger (after da_cong_khai=true)      │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                           ▲                                      │        │
│  │                           │ references                           │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  chi_tiet_dinh_muc (Quota Line Items)                    │    │        │
│  │  │  ├── Links decision + equipment category                 │    │        │
│  │  │  ├── Denormalized don_vi_id for isolation                │    │        │
│  │  │  └── mua_sam_tap_trung flag (Circular 01/2026)          │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                           │                                      │        │
│  │                           │ triggers audit                       │        │
│  │                           ▼                                      │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  lich_su_dinh_muc (Audit Log - APPEND ONLY)              │    │        │
│  │  │  ├── snapshot_truoc / snapshot_sau (JSONB)               │    │        │
│  │  │  ├── thao_tac: tao/cap_nhat/dieu_chinh/huy/cong_khai    │    │        │
│  │  │  └── RULE prevents UPDATE/DELETE                         │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                                                                  │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  v_so_sanh_dinh_muc (Compliance View)                    │    │        │
│  │  │  ├── Joins quota ↔ actual inventory                      │    │        │
│  │  │  └── Calculates: đạt / thiếu / vượt                      │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                           ▲                                      │        │
│  │                           │ counts from                          │        │
│  │  ┌─────────────────────────────────────────────────────────┐    │        │
│  │  │  thiet_bi (Existing Equipment Table)                     │    │        │
│  │  │  └── nhom_dinh_muc_id → links to category               │    │        │
│  │  └─────────────────────────────────────────────────────────┘    │        │
│  │                                                                  │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Data Flows

### 1. Create Quota Decision (Draft)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │  Frontend   │     │  API Proxy  │     │  Database   │
│  (to_qltb)  │     │             │     │             │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ Click "Create"    │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ Fill form:        │                   │
       │                   │ - so_quyet_dinh   │                   │
       │                   │ - ngay_ban_hanh   │                   │
       │                   │ - nguoi_ky        │                   │
       │                   │ - hieu_luc_tu     │                   │
       │                   │                   │                   │
       │ Submit            │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ callRpc({         │                   │
       │                   │   fn: 'dinh_muc_  │                   │
       │                   │   quyet_dinh_     │                   │
       │                   │   create',        │                   │
       │                   │   args: {...}     │                   │
       │                   │ })                │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ 1. Validate       │
       │                   │                   │    NextAuth       │
       │                   │                   │    session        │
       │                   │                   │                   │
       │                   │                   │ 2. Check          │
       │                   │                   │    ALLOWED_       │
       │                   │                   │    FUNCTIONS      │
       │                   │                   │                   │
       │                   │                   │ 3. Override       │
       │                   │                   │    p_don_vi       │
       │                   │                   │    (to_qltb       │
       │                   │                   │    can't choose)  │
       │                   │                   │                   │
       │                   │                   │ 4. Sign JWT       │
       │                   │                   │    with claims    │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │                   │ RPC Function:
       │                   │                   │                   │ - Extract claims
       │                   │                   │                   │ - Verify role
       │                   │                   │                   │ - Force don_vi
       │                   │                   │                   │
       │                   │                   │                   │ INSERT INTO
       │                   │                   │                   │ quyet_dinh_dinh_muc
       │                   │                   │                   │ (trang_thai='draft')
       │                   │                   │                   │
       │                   │                   │                   │ INSERT INTO
       │                   │                   │                   │ lich_su_dinh_muc
       │                   │                   │                   │ (thao_tac='tao')
       │                   │                   │                   │
       │                   │                   │<──────────────────│
       │                   │                   │ {id, success}     │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ invalidateQueries │                   │
       │                   │ (deviceQuotaKeys) │                   │
       │                   │                   │                   │
       │<──────────────────│                   │                   │
       │ Show success      │                   │                   │
       │ toast + refresh   │                   │                   │
       │                   │                   │                   │
```

### 2. Add Line Items to Decision

```
┌─────────────┐     ┌─────────────────────────────────────────────────────┐
│   User      │     │                    Frontend                         │
└──────┬──────┘     │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
       │            │  │ TreeTable   │  │ Category     │  │ Quota Form │ │
       │            │  │ (hierarchy) │  │ Selector     │  │            │ │
       │            │  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
       │            └─────────┼────────────────┼────────────────┼────────┘
       │                      │                │                │
       │ View categories      │                │                │
       │─────────────────────>│                │                │
       │                      │                │                │
       │                      │ useNhomThietBiList()            │
       │                      │ (loads hierarchy tree)          │
       │                      │                │                │
       │<─────────────────────│                │                │
       │ Display tree:        │                │                │
       │ I. Đặc thù           │                │                │
       │   A. Chẩn đoán       │                │                │
       │     1. CT Scanner    │                │                │
       │     2. MRI           │                │                │
       │                      │                │                │
       │ Select "CT Scanner"  │                │                │
       │─────────────────────>│───────────────>│                │
       │                      │                │                │
       │                      │                │ Show form:     │
       │                      │                │───────────────>│
       │                      │                │                │
       │ Enter quota: 2       │                │                │
       │─────────────────────────────────────────────────────>│
       │                      │                │                │
       │                      │                │                │ callRpc({
       │                      │                │                │   fn: 'dinh_muc_
       │                      │                │                │   chi_tiet_upsert',
       │                      │                │                │   args: {
       │                      │                │                │     p_quyet_dinh_id,
       │                      │                │                │     p_nhom_thiet_bi_id,
       │                      │                │                │     p_so_luong_dinh_muc: 2
       │                      │                │                │   }
       │                      │                │                │ })
       │                      │                │                │
       │                      │                │                │  ──────────────>
       │                      │                │                │                │
       │                      │                │                │    Database:
       │                      │                │                │    - Verify decision
       │                      │                │                │      not published
       │                      │                │                │    - UPSERT into
       │                      │                │                │      chi_tiet_dinh_muc
       │                      │                │                │    - Auto-set don_vi_id
       │                      │                │                │      from parent
       │                      │                │                │    - Log to audit
       │                      │                │                │
       │<─────────────────────────────────────────────────────│
       │ Update tree with quota badge                         │
       │                      │                │                │
```

### 3. Activate & Publish Decision

```
                    ACTIVATE FLOW                          PUBLISH FLOW
                    ════════════                           ════════════

┌─────────┐                                    ┌─────────┐
│  DRAFT  │                                    │ ACTIVE  │
│ Decision│                                    │ Decision│
└────┬────┘                                    └────┬────┘
     │                                              │
     │ User clicks "Activate"                       │ User clicks "Publish"
     │                                              │
     ▼                                              ▼
┌────────────────────────────┐            ┌────────────────────────────┐
│ dinh_muc_quyet_dinh_       │            │ dinh_muc_quyet_dinh_       │
│ activate(p_id)             │            │ publish(p_id)              │
└────────────────────────────┘            └────────────────────────────┘
     │                                              │
     ▼                                              ▼
┌────────────────────────────┐            ┌────────────────────────────┐
│ 1. Find current ACTIVE     │            │ 1. Check trang_thai =      │
│    decision for tenant     │            │    'active'                │
│                            │            │                            │
│ 2. If exists:              │            │ 2. Check NOT already       │
│    - Set to 'replaced'     │            │    published               │
│    - Log 'huy' to audit    │            │                            │
│                            │            │ 3. Set da_cong_khai=true   │
│ 3. Set new decision to     │            │    ngay_cong_khai=now()    │
│    'active'                │            │                            │
│    thay_the_cho_id = old   │            │ 4. Log 'cong_khai'         │
│                            │            │                            │
│ 4. Log 'cap_nhat'          │            │ 5. IMMUTABILITY TRIGGER    │
│                            │            │    now prevents changes    │
└────────────────────────────┘            └────────────────────────────┘
     │                                              │
     ▼                                              ▼
┌─────────┐                                    ┌─────────────┐
│ ACTIVE  │                                    │  PUBLISHED  │
│ Decision│                                    │  (locked)   │
└─────────┘                                    └─────────────┘
     │                                              │
     │                                              │ Cannot modify:
     │                                              │ - so_quyet_dinh
     │                                              │ - ngay_ban_hanh
     │                                              │ - chi_tiet items
     │                                              │
     │                                              │ CAN do:
     │                                              │ - Set to 'replaced'
     │                                              │ - Update attachment
```

### 4. Compliance Check Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         COMPLIANCE DASHBOARD                              │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ useComplianceReport()
                                    │ callRpc('dinh_muc_bao_cao_tuan_thu')
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      v_so_sanh_dinh_muc (VIEW)                            │
│                                                                           │
│  SELECT                                                                   │
│    chi_tiet.nhom_thiet_bi_id,                                            │
│    chi_tiet.so_luong_dinh_muc AS quota,        ◄── From chi_tiet_dinh_muc│
│    chi_tiet.so_luong_toi_thieu AS minimum,                               │
│    COUNT(thiet_bi.*) AS actual_count,          ◄── From thiet_bi table   │
│    CASE                                                                   │
│      WHEN actual > quota THEN 'vuot'           ◄── Over quota            │
│      WHEN actual < minimum THEN 'thieu'        ◄── Below minimum         │
│      ELSE 'dat'                                ◄── Compliant             │
│    END AS trang_thai_tuan_thu                                            │
│  FROM chi_tiet_dinh_muc chi_tiet                                         │
│  JOIN quyet_dinh_dinh_muc qd ON qd.id = chi_tiet.quyet_dinh_id           │
│    AND qd.trang_thai = 'active'                ◄── Only active decision  │
│  LEFT JOIN thiet_bi ON                                                   │
│    thiet_bi.don_vi_id = chi_tiet.don_vi_id                               │
│    AND thiet_bi.nhom_dinh_muc_id = chi_tiet.nhom_thiet_bi_id            │
│    AND thiet_bi.trang_thai NOT IN ('thanh_ly', 'mat')  ◄── Active only  │
│  GROUP BY chi_tiet.id                                                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD OUTPUT                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │  Summary:                                                        │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │     │
│  │  │  ĐẠT     │  │  THIẾU   │  │  VƯỢT    │                       │     │
│  │  │   15     │  │    3     │  │    2     │                       │     │
│  │  │  items   │  │  items   │  │  items   │                       │     │
│  │  └──────────┘  └──────────┘  └──────────┘                       │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │  Details Table:                                                  │     │
│  │  ┌──────────────────┬──────┬────────┬────────┬─────────┐        │     │
│  │  │ Equipment        │ Quota│ Minimum│ Actual │ Status  │        │     │
│  │  ├──────────────────┼──────┼────────┼────────┼─────────┤        │     │
│  │  │ CT Scanner       │  1   │   1    │   1    │  ĐẠT    │        │     │
│  │  │ MRI System       │  1   │   1    │   0    │  THIẾU  │        │     │
│  │  │ Ventilator       │ 12   │   8    │  15    │  VƯỢT   │        │     │
│  │  │ Ultrasound       │  5   │   3    │   4    │  ĐẠT    │        │     │
│  │  └──────────────────┴──────┴────────┴────────┴─────────┘        │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Role-Based Access Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROLE-BASED ACCESS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │     global      │──────────────────────────────────────────┐             │
│  │     admin       │                                          │             │
│  └─────────────────┘                                          │             │
│          │                                                    │             │
│          │ Can access ALL tenants                             │             │
│          │ Can override p_don_vi                              │             │
│          ▼                                                    │             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ALL OPERATIONS                               │   │
│  │  - Create/Edit/Activate/Publish decisions                           │   │
│  │  - Add/Remove line items                                            │   │
│  │  - View all compliance reports                                      │   │
│  │  - View audit logs                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ regional_leader │──────────────────────────────────────────┐             │
│  └─────────────────┘                                          │             │
│          │                                                    │             │
│          │ Can view MULTIPLE tenants (in region)              │             │
│          │ CANNOT modify (read-only)                          │             │
│          ▼                                                    │             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         READ-ONLY                                    │   │
│  │  - View decisions across region                                     │   │
│  │  - View compliance reports                                          │   │
│  │  - Export reports                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │     to_qltb     │──────────────────────────────────────────┐             │
│  └─────────────────┘                                          │             │
│          │                                                    │             │
│          │ Can access OWN TENANT ONLY                         │             │
│          │ p_don_vi FORCED from JWT (cannot override)         │             │
│          ▼                                                    │             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FULL TENANT OPERATIONS                            │   │
│  │  - Create/Edit/Activate/Publish decisions                           │   │
│  │  - Add/Remove line items                                            │   │
│  │  - View own compliance report                                       │   │
│  │  - Export own reports                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │  technician     │                                                        │
│  │  qltb_khoa      │──────────────────────────────────────────┐             │
│  │  user           │                                          │             │
│  └─────────────────┘                                          │             │
│          │                                                    │             │
│          │ Own tenant + department only                       │             │
│          ▼                                                    │             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         READ-ONLY                                    │   │
│  │  - View decisions (own tenant)                                      │   │
│  │  - View compliance (own tenant/department)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────┐
│         don_vi              │
│  (Tenants/Facilities)       │
├─────────────────────────────┤
│  id                         │◄─────────────────────────────────────┐
│  ten_don_vi                 │                                      │
│  ...                        │                                      │
└─────────────────────────────┘                                      │
              │                                                      │
              │ 1:N                                                  │
              ▼                                                      │
┌─────────────────────────────┐                                      │
│   quyet_dinh_dinh_muc       │                                      │
│   (Quota Decisions)         │                                      │
├─────────────────────────────┤       ┌─────────────────────────────┐│
│  id                         │◄──────│   nhom_thiet_bi_dinh_muc    ││
│  don_vi_id ─────────────────┼───────│   (Equipment Categories)    ││
│  so_quyet_dinh              │       ├─────────────────────────────┤│
│  ngay_ban_hanh              │       │  id                         ││
│  nguoi_ky                   │       │  parent_id (self-ref)       ││
│  hieu_luc_tu                │       │  ma_nhom                    ││
│  hieu_luc_den               │       │  ten_nhom                   ││
│  trang_thai                 │       │  loai_cap                   ││
│  da_cong_khai               │       │  phan_loai (A/B)            ││
│  phien_ban                  │       │  path (ltree)               ││
│  thay_the_cho_id (self-ref) │       │  is_leaf                    ││
│  created_by                 │       │  don_vi_tinh                ││
│  created_at                 │       └─────────────────────────────┘│
└─────────────────────────────┘                    │                 │
              │                                    │                 │
              │ 1:N                                │                 │
              ▼                                    ▼                 │
┌─────────────────────────────────────────────────────────────────┐  │
│                    chi_tiet_dinh_muc                            │  │
│                    (Quota Line Items)                           │  │
├─────────────────────────────────────────────────────────────────┤  │
│  id                                                             │  │
│  quyet_dinh_id ─────────────────────────────────────────────────┤  │
│  don_vi_id (denormalized) ──────────────────────────────────────┼──┘
│  nhom_thiet_bi_id ──────────────────────────────────────────────┤
│  don_vi_tinh                                                    │
│  so_luong_dinh_muc                                              │
│  so_luong_toi_thieu                                             │
│  khoa_phong_id ─────────────────────────────────────────────────┤
│  mua_sam_tap_trung                                              │
│  can_cu_tinh_toan                                               │
└─────────────────────────────────────────────────────────────────┘
              │                                    │
              │ triggers                           │ JOIN
              ▼                                    ▼
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   lich_su_dinh_muc          │       │         thiet_bi            │
│   (Audit Log)               │       │   (Existing Equipment)      │
├─────────────────────────────┤       ├─────────────────────────────┤
│  id                         │       │  id                         │
│  chi_tiet_id                │       │  don_vi_id                  │
│  quyet_dinh_id              │       │  nhom_dinh_muc_id ──────────┤
│  don_vi_id                  │       │  trang_thai                 │
│  thao_tac                   │       │  ...                        │
│  snapshot_truoc (JSONB)     │       └─────────────────────────────┘
│  snapshot_sau (JSONB)       │                    │
│  ly_do                      │                    │
│  thuc_hien_boi              │                    │ COUNT
│  thoi_diem                  │                    ▼
│                             │       ┌─────────────────────────────┐
│  ⚠️ APPEND-ONLY             │       │    v_so_sanh_dinh_muc       │
│  (no UPDATE/DELETE)         │       │    (Compliance View)        │
└─────────────────────────────┘       ├─────────────────────────────┤
                                      │  quota                      │
                                      │  minimum                    │
                                      │  actual_count               │
                                      │  trang_thai_tuan_thu        │
                                      │  (đạt/thiếu/vượt)           │
                                      └─────────────────────────────┘
```

---

## Cache Invalidation Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    TanStack Query Cache Strategy                          │
└──────────────────────────────────────────────────────────────────────────┘

Query Keys Hierarchy:
────────────────────
['device-quota']
    │
    ├── ['device-quota', 'categories', { phanLoai }]
    │       └── Invalidate: When categories change (rare, admin only)
    │
    ├── ['device-quota', 'decisions', { donViId, trangThai }]
    │       └── Invalidate: On create, activate, publish
    │
    ├── ['device-quota', 'decision', id]
    │       └── Invalidate: On update, activate, publish
    │
    ├── ['device-quota', 'details', quyetDinhId]
    │       └── Invalidate: On upsert, delete line items
    │
    └── ['device-quota', 'compliance', donViId]
            └── Invalidate: On line item changes, equipment changes


Mutation → Cache Invalidation Map:
──────────────────────────────────

┌─────────────────────────────┐     ┌─────────────────────────────────────┐
│ useCreateQuyetDinh          │────>│ invalidate(['device-quota'])        │
└─────────────────────────────┘     │ (all quota queries)                 │
                                    └─────────────────────────────────────┘

┌─────────────────────────────┐     ┌─────────────────────────────────────┐
│ useActivateQuyetDinh        │────>│ invalidate(['device-quota'])        │
└─────────────────────────────┘     │ (compliance changes when active     │
                                    │  decision changes)                  │
                                    └─────────────────────────────────────┘

┌─────────────────────────────┐     ┌─────────────────────────────────────┐
│ usePublishQuyetDinh         │────>│ invalidate(['device-quota',         │
└─────────────────────────────┘     │   'decisions'])                     │
                                    │ (only decision list needs refresh)  │
                                    └─────────────────────────────────────┘

┌─────────────────────────────┐     ┌─────────────────────────────────────┐
│ useUpsertChiTiet            │────>│ invalidate(['device-quota',         │
└─────────────────────────────┘     │   'details', quyetDinhId])          │
                                    │ invalidate(['device-quota',         │
                                    │   'compliance'])                    │
                                    └─────────────────────────────────────┘
```

---

## Security Flow Summary

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SECURITY CHECKPOINTS                              │
└──────────────────────────────────────────────────────────────────────────┘

Request: POST /api/rpc/dinh_muc_quyet_dinh_create
         Body: { p_so_quyet_dinh: "15/QĐ-BV", p_don_vi: 999 }  ◄── Attacker
                                                                   tries to
                                                                   access
                                                                   tenant 999
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT 1: NextAuth Session Validation                               │
│  ────────────────────────────────────────                               │
│  - Verify session token                                                 │
│  - Extract user info                                                    │
│  - REJECT if not authenticated                                          │
└─────────────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT 2: Function Whitelist                                        │
│  ────────────────────────────────                                       │
│  - Check fn in ALLOWED_FUNCTIONS array                                  │
│  - REJECT if function not whitelisted                                   │
└─────────────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT 3: Tenant Override (CRITICAL)                                │
│  ────────────────────────────────────────                               │
│  User role = 'to_qltb', user's don_vi = 42                              │
│                                                                          │
│  if (role !== 'global' && role !== 'admin') {                           │
│    args.p_don_vi = session.user.don_vi;  // FORCE to 42                 │
│  }                                                                       │
│                                                                          │
│  Attacker's p_don_vi: 999 → OVERWRITTEN to 42                           │
└─────────────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT 4: JWT Signing                                               │
│  ────────────────────────                                               │
│  JWT Claims = {                                                          │
│    app_role: 'to_qltb',                                                 │
│    don_vi: '42',          ◄── User's actual tenant                      │
│    user_id: '123',                                                      │
│    dia_ban_id: '5'                                                      │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT 5: RPC Function (Database Level)                             │
│  ───────────────────────────────────────────                            │
│  v_role := jwt->>'app_role';  -- 'to_qltb'                              │
│  v_don_vi := jwt->>'don_vi';  -- '42'                                   │
│                                                                          │
│  -- Double enforcement (defense in depth)                                │
│  IF v_role NOT IN ('global', 'admin') THEN                              │
│    p_don_vi := v_don_vi;  -- Force again to '42'                        │
│  END IF;                                                                 │
│                                                                          │
│  INSERT INTO quyet_dinh_dinh_muc (don_vi_id, ...) VALUES (42, ...);     │
└─────────────────────────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RESULT: Decision created for tenant 42 (user's actual tenant)          │
│          Attacker's attempt to access tenant 999 BLOCKED                 │
└─────────────────────────────────────────────────────────────────────────┘
```
