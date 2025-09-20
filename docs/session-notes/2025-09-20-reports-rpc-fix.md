# Reports RPC Fix – 2025-09-20

Context
- Inventory Reports toast caused by direct table reads and missing/invalid transfer RPC.
- `transfer_request_list` returned 404 (not deployed) and had potential bigint=text comparisons in some envs.

Changes
- Refactored `src/app/(app)/reports/hooks/use-inventory-data.ts` to use RPCs; catch 404 for `transfer_request_list` to avoid destructive toast.
- Patched `supabase/migrations/20250915_transfers_rpcs_more.sql`:
  - Cast `don_vi` claim to BIGINT in `transfer_request_list`.
  - Guard `transfer_history_list` when `public.lich_su_luan_chuyen` is absent; fixed PL/pgSQL quoting.

Outcome
- 404 resolved after applying migration in Supabase.
- Inventory Reports loads without error; exports/liquidations populated once RPC exists.

Next
- Align maintenance reports hook to RPCs (`repair_request_list`, `maintenance_*`).