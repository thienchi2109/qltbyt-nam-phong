# BUG — Temperature Monitoring equipment-manager tenant scope

- Status: Done under explicit DB Gate bypass
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

Disposable regression plus nine existing TM suites PASS; test database cleanup confirmed. Independent standards/spec review has no remaining concrete findings. Source commit `c2f1c9c3` was integrated and pushed to main with hooks enabled. After the owner's explicit authorization on 2026-10-23, three migrations were applied sequentially through Supabase MCP and their exact SQL was read back. `ntchi2` same-tenant/different-department read RPCs now succeed; cross-tenant, ordinary-role wrong-department, and missing-role requests remain denied. No live configuration or reading was created.

Static timed out (exit 124); formal baseline-forward remains INCOMPLETE under the explicitly approved bypass. Formal certification and remaining feature-wide TM-10 UAT remain tracked in `TM-10-integration-performance-release.md`; this bug's closure does not certify TM-10.
