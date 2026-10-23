# BUG — Global/admin tenant options RPC

- Status: Done under explicit gate bypass; live repair and manual test DB catch-up verified; formal DB Gate INCOMPLETE
- Evidence: `docs/reports/global-tenant-options-debug-2026-10-23.md`
- Regression: `supabase/tests/facility_options_dataset_behavior.sql`

The dataset overload of `get_facilities_with_equipment_count` references an undeclared `tb` alias in its global branch. Raw admin is normalized to global, so both roles lose facility options. Without a saved selection, the shared data-fetch gate remains closed. `to_qltb` bypasses the selector and still fetches its own tenant.

## Acceptance

- A new forward migration fixes the global SQL branch without editing applied history.
- The regression passes for regular, placed, and all datasets; tenant isolation and existing callers remain covered.
- Static and baseline-forward evidence are reported separately; no formal PASS is inferred from manual catch-up or isolated test runs.
- The owner approved preparing the forward migration; a live write needs separate explicit authorization.

Migration: `supabase/migrations/20261023150000_fix_global_facility_options_dataset_alias.sql`. The unchanged regression passes for all three datasets after the candidate on a fresh caught-up Oracle clone; authenticated global returns 28 facilities and `to_qltb` response/ACL remain unchanged. The test is required for this migration in the gate registry. Clone removal was confirmed.

After explicit owner authorization, live apply recorded version `20261023150839`; exact SQL hash and four read-only behavior checks passed on both live and persistent `qltbyt_test`. Both now have 398 migrations. No browser smoke or formal gate PASS is claimed. Evidence: `docs/reports/global-tenant-options-live-apply-2026-10-23.json`.

## Separate follow-up scope

- Test and repair dataset counts in the non-global branch.
- Add role/user identity claim guards to the legacy facility-options RPC under a separately tested hardening change.
- Check Reports/chart facility-cache scope across account/region changes.
- Show a failed facilities request distinctly from a successful empty result.
- Recover the unhealthy Oracle quality-gate state and historical SQL identity differences through a separately approved maintenance path.
