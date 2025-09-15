Approved plan (2025-09-14): No-RLS, RPC-only multi-tenant architecture.

Decisions:
- Role names: `global`, `to_qltb`, `technician`, `user`.
- Multi-tenant: users can belong to multiple `don_vi`; active tenant stored in `nhan_vien.current_don_vi`.
- JWT claims: `role` (string), `don_vi` (current tenant ID). Optionally `don_vi_list` for UI.
- Technician write rule: may create/update only when BOTH `don_vi = jwt.don_vi` AND `khoa_phong` matches their own dept in that tenant.

Phases:
1) Schema: create `don_vi`; add `don_vi` to `nhan_vien` & `thiet_bi`; add `current_don_vi` to `nhan_vien`; add `user_don_vi_memberships`; indexes + FKs; backfill scaffold.
2) RPCs (read): `equipment_list`, `equipment_get` filter by `jwt.don_vi` for non-`global`; support pagination/sorting.
3) RPCs (write): `equipment_create`, `equipment_update`, `equipment_delete` enforce tenant/role checks; set `don_vi := jwt.don_vi` inside INSERT.
4) Lockdown: REVOKE table/sequence privileges; only GRANT EXECUTE on RPCs.
5) Auth & Switcher: NextAuth emits claims; switcher updates `current_don_vi` then refresh session.
6) Frontend refactor: replace table calls with RPCs in equipment/maintenance/repairs/transfers/exports; cache keys include `don_vi`.
7) Tests & rollout: verify isolation and role rules; deploy in stages, then revoke table access; document.

Next action:
- Start Phase 1 migrations + equipment RPC set on branch `feat/multi-tenant`.
