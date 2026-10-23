# BUG — Temperature Monitoring equipment-manager tenant scope

- Status: In Progress
- Spec: `docs/specs/temperature-monitoring.md`
- Evidence: `docs/reports/temperature-monitoring-manager-scope-2026-10-23.md`

`to_qltb` must configure and monitor equipment throughout its own tenant, matching Equipment scope. The existing TM department condition rejects valid equipment and prevents configuration choices from loading.

## Acceptance

- Same-tenant/different-department managers can configure and record readings, and see them in workspace/export/deviations.
- Cross-tenant access remains denied; ordinary roles retain department and action restrictions.
- Missing identity claims fail closed, including configuration history.
- Additive migrations and regression test are reviewed, integrated, and applied only with operation-specific live authorization.
- Static and formal baseline-forward results are recorded separately; unresolved gate failures require explicit bypass approval for this migration batch.

## Current evidence and remaining work

Disposable regression plus nine existing TM suites PASS; test database cleanup confirmed. Independent standards/spec review has no remaining concrete findings. Static timed out (exit 124); formal baseline-forward remains INCOMPLETE. Owner explicitly authorized integration, DB Gate bypass for this batch, and sequential live apply of the three migrations on 2026-10-23. Integration/apply/read-back are in progress.
