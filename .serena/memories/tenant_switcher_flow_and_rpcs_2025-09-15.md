Tenant Switcher flow (2025-09-15)
- UI: `src/components/tenant-switcher.tsx` shows memberships and POSTs to `/api/tenants/switch`.
- Memberships API: `GET /api/tenants/memberships` queries `user_don_vi_memberships` + join to `don_vi` to list `{don_vi, name, code}`.
- Switch API: `POST /api/tenants/switch` validates the user is a member of `don_vi`, updates `nhan_vien.current_don_vi`, returns `{ok:true}`.
- Session sync: NextAuth `jwt` callback reads `nhan_vien.current_don_vi` each request and sets `token.don_vi`; client calls `session.update()` after switching to refresh.
- RPC proxy: `src/app/api/rpc/[fn]/route.ts` signs JWT claims with `app_role` (admin→global), `don_vi`, `user_id`. SQL RPCs use `_get_jwt_claim` to enforce tenant.
- User management: `tenant_list`, `user_create`, `user_membership_add/remove`, `user_set_current_don_vi` implemented; Add User dialog uses `user_create` with `p_current_don_vi` and optional memberships.
- Note: Non-global users can switch only to tenants they are members of; global/admin can switch to any membership they possess.