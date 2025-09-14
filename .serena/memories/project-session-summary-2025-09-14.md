Session summary (2025-09-14):

High-level goals addressed:
- Replace app logo with transparent PNG hosted at https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png and adjust UI so transparent background doesn't cause visual issues.
- Fix admin password reset flow by adding a `reset_password_by_admin` RPC and DB migrations to create missing `nhan_vien` columns and ensure `pgcrypto` functions are schema-qualified.
- Increase logo size on login/loading screen.
- Make equipment table rows clickable to open detail dialog and prevent action menu clicks from also opening details.

Files changed (frontend):
- `src/components/icons.tsx` - replaced logo URL, removed circular crop, added `size` prop and `className` prop to control rendering sizes.
- `src/app/page.tsx` - removed rounded circular wrapper around logo; added light rounded tile to avoid transparent PNG bleed-through.
- `src/app/(app)/layout.tsx` - increased loading logo size to `<Logo size={96} className="w-24 h-24" />`.
- `src/app/(app)/users/page.tsx` - updated toast handling for `reset_password_by_admin` RPC to use returned JSON `message`.
- `src/app/(app)/equipment/page.tsx` - added `onClick={() => handleShowDetails(row.original)}` and `className="hover:bg-muted cursor-pointer"` to table rows; added `onClick` stopPropagation to the action menu button.
- Multiple static templates and other components had logo URL replacements where hardcoded previously (search for old i.postimg URLs).

Files changed (backend/migrations):
- `supabase/migrations/20250914_add_reset_password_by_admin.sql` - new RPC `public.reset_password_by_admin(p_admin_user_id INTEGER, p_target_user_id INTEGER) RETURNS jsonb` (SECURITY DEFINER). Uses schema-qualified `extensions.crypt` and `extensions.gen_salt`, and sets `SET search_path = public, extensions` to ensure visibility on Supabase.
- `supabase/migrations/20250914_add_password_changed_at.sql` - updated to use `DROP FUNCTION IF EXISTS` and schema-qualified extension functions.
- `supabase/migrations/20250914_add_missing_nhan_vien_columns.sql` - adds `failed_attempts INTEGER DEFAULT 0 NOT NULL` and `password_reset_required BOOLEAN DEFAULT false NOT NULL` to `nhan_vien` if missing.

Current runtime/dev status and pending actions:
- Frontend edits applied and dev server started locally; visual verification pending from the user (login loading logo size and tile appearance).
- Migrations created in repo but must be applied to the production/staging Supabase database. User previously ran partial SQL and encountered errors:
  - `function gen_salt(unknown) does not exist` — fixed by qualifying extension functions and setting `search_path` in the RPC.
  - `column "failed_attempts" of relation "nhan_vien" does not exist` — fixed via migration to add missing column.
- Recommended DB steps remaining: apply the migrations in `supabase/migrations/` to the live Supabase project (or run SQL in SQL editor), then reload PostgREST schema cache in Supabase (via dashboard or `NOTIFY pgrst, 'reload schema'`) so RPCs are visible to the API.

Important runtime variables and UX notes:
- RPC signature expected by frontend: `reset_password_by_admin(p_admin_user_id INTEGER, p_target_user_id INTEGER)` returning JSON with fields `success`, `message`, `username`, and `new_password`.
- UI behavior: action menu `More` button now stops click propagation to avoid opening row details; table rows are clickable and call `handleShowDetails(equipment)` which sets `selectedEquipment` and `isDetailModalOpen`.

Next recommended steps (for user or deployer):
1. Apply SQL migrations in `supabase/migrations/` to the Supabase DB.
2. Ensure `pgcrypto` extension is created in `extensions` schema if not present: `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`.
3. Reload PostgREST schema cache (Supabase dashboard or `NOTIFY pgrst, 'reload schema'`).
4. Re-test admin reset password flow and verify `nhan_vien.password_changed_at` and `failed_attempts` updates and toasts.
5. Visual check of login/loading screens for logo size and tile appearance; adjust `Logo` `size` and wrapper classes if needed.

User preferences captured:
- Use the provided transparent PNG as the primary logo, avoid circular cropping; prefer a subtle light tile behind it on login to prevent background bleed.

Reference commands (if needed):
- Apply migrations locally via Supabase CLI (if configured): `supabase db push` or run the SQL files in the Supabase SQL editor.
- Force PostgREST schema reload: `NOTIFY pgrst, 'reload schema';` (execute in SQL editor).

Saved by: assistant session on 2025-09-14

