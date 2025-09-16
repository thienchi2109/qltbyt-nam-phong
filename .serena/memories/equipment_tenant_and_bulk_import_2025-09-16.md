Summary of session (2025-09-16):

Scope
- Reviewed transfers page RPC usage (all via RPC proxy), noted minor inconsistency: add-transfer-dialog should use departments_list instead of equipment_departments_list.
- Implemented tenant-aware UI enhancement for Equipment Add dialog.
- Fixed Excel bulk import path to ensure don_vi is auto-set, and added a true bulk RPC for performance.

Auth + Claims
- NextAuth JWT and session include don_vi (tenant) via src/auth/config.ts callbacks.
- RPC proxy (/api/rpc/[fn]/route.ts) whitelists allowed functions and signs a JWT with claims: app_role, don_vi, user_id.
- DB RPCs read claims using _get_jwt_claim and enforce tenant logic.

Database + RPCs
- don_vi table exists; nhan_vien and thiet_bi reference it.
- equipment_create(p_payload jsonb) sets thiet_bi.don_vi from JWT claim don_vi; enforces role rules.
- tenant_list() returns active tenants as JSONB with id, code, name.
- departments_list() exists and is whitelisted.
- New RPC: equipment_bulk_import(p_items jsonb) (20250916_equipment_bulk_import.sql)
  * Loops server-side through items and calls equipment_create for each, so all tenant/role checks and don_vi assignment apply.
  * Returns a JSON summary: { success, inserted, failed, total, details: [{ index, success, error? }, ...] }.
  * GRANT EXECUTE TO authenticated.

Frontend changes
- AddEquipmentDialog (src/components/add-equipment-dialog.tsx)
  * Added read-only "Đơn vị" field.
  * Uses useSession() to get current user, calls tenant_list via callRpc to resolve tenant name by session.user.don_vi.
  * Field is disabled/read-only; server continues to set don_vi automatically in equipment_create.
- ImportEquipmentDialog (src/components/import-equipment-dialog.tsx)
  * Replaced per-record supabase.rpc calls with RPC proxy callRpc to ensure JWT claims are included.
  * Implemented bulk path calling equipment_bulk_import once and showing a summary to the user.
- RPC gateway whitelist updated (src/app/api/rpc/[fn]/route.ts) to include equipment_bulk_import.

Why this matters
- Both single-item add and bulk Excel import now consistently auto-fill don_vi server-side based on the current tenant, improving clarity and enforcing tenant security.

Potential follow-ups
- Add UI surface for per-row failures in import (e.g., downloadable CSV of failed rows).
- Consider a single INSERT strategy for even higher throughput if we want to bypass per-row equipment_create while re-implementing its validations.
- Transfers: update add-transfer-dialog to use departments_list if still using equipment_departments_list.

Environment notes
- User prefers npm.
- Windows (pwsh), repo root: D:\qltbyt-nam-phong.

Files touched
- src/components/add-equipment-dialog.tsx (read-only "Đơn vị" UI, tenant resolution)
- src/components/import-equipment-dialog.tsx (use callRpc, call equipment_bulk_import)
- src/app/api/rpc/[fn]/route.ts (whitelist equipment_bulk_import)
- supabase/migrations/20250916_equipment_bulk_import.sql (new RPC)
