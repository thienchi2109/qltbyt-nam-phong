# Cached Maintenance Hooks Export Cleanup Design (2026-03-02)

## 1. Context
- React Doctor / Knip reports still show unused re-export warnings for `src/hooks/use-cached-maintenance.ts`.
- Phase 1 scope limits us to trimming unused barrel exports without deleting implementation files.
- Prior batches (bulk-import, rr-prefs) established a pattern: remove unused exports + add guard tests to lock the public surface.
- Hybrid policy from user: some helpers may remain exported with tests guarding visibility; others should disappear from the public API entirely.

## 2. Objectives
1. Remove unused hook exports from `use-cached-maintenance.ts` while keeping implementation code untouched.
2. Keep required helpers (e.g., `maintenanceKeys`) exported and covered by positive guard tests.
3. Provide regression tests confirming the hybrid visibility policy.
4. Satisfy verification gates (typecheck, lint, test:run) per project standard.

## 3. Inventory & Classification
| Export | Usage Summary | Category |
| --- | --- | --- |
| `maintenanceKeys` | Used in realtime context, maintenance context, tests (+others) | Keep exposed |
| `useMaintenancePlans` | Used by dashboard tabs, maintenance page client | Keep exposed |
| `useMaintenanceSchedules` | No references across repo | Remove export |
| `useMaintenanceHistory` | Only used by equipment detail history tab for plan timeline | Keep exposed |
| `useMaintenanceDetail` | No references | Remove export |
| `useCreateMaintenancePlan` | Used by maintenance context/operations | Keep exposed |
| `useUpdateMaintenancePlan` | Used by maintenance context/operations | Keep exposed |
| `useApproveMaintenancePlan` | Used by maintenance dialogs | Keep exposed |
| `useRejectMaintenancePlan` | Used by maintenance dialogs | Keep exposed |
| `useDeleteMaintenancePlan` | Used by maintenance list actions | Keep exposed |
| `useCreateMaintenanceSchedule` | No references | Remove export |
| `useUpdateMaintenanceSchedule` | Used by maintenance tasks editing | Keep exposed |
| `useCompleteMaintenance` | No references | Remove export (still accessible internally) |
| `useDeleteMaintenanceSchedule` | No references | Remove export |

## 4. Cleanup Strategy
1. **Category B removal**
   - Delete the named exports from the barrel (function definitions remain in file).
   - No import rewrites needed because nothing currently references them.
2. **Category A guardrails**
   - Keep exports for commonly used helpers (`maintenanceKeys`, etc.).
   - Add vitest assertions that these helpers remain accessible while removed hooks stay hidden.
3. **Testing pattern**
   - Add `src/hooks/__tests__/use-cached-maintenance-barrel.test.ts` (name TBD) to house guard tests similar to `rr-prefs` and bulk import suites.

## 5. Testing & Verification
- **Guard tests**: Write failing tests first to ensure removed hooks are not exported; keepers are still available.
- **Quality gates**: `node scripts/npm-run.js run test:run`, `... run typecheck`, `... run lint`. Document known lint baseline issues if they appear.
- **React Doctor**: rerun score/verbose scans after this batch if required by overall remediation plan.

## 6. Risks & Mitigations
- **False positives (hook actually used dynamically)**: rely on exhaustive static search; if unsure, classify as Category A and leave exported.
- **Future deletions**: Implementation files stay intact, so we can revisit in Phase 2/3 without affecting runtime now.
- **Lint/test failures unrelated to this work**: call out baseline failures explicitly so reviewers understand they predate this change.

## 7. Next Steps
1. Execute usage inventory.
2. Apply hybrid export cleanup per categories.
3. Add guard tests.
4. Run verification commands and summarize results.
