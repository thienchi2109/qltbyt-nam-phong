# Chunk 4q — Repair lifecycle audit and status summary

Batch gồm Entry 29 và 31.

- Entry 29: core giữ audit row/detail/history contracts và audit-log fail-closed
  paths; migration-specific giữ lifecycle transitions, terminal state and
  delete behavior. Fixtures and rollback remain independent.
- Entry 31: core giữ global/facility/regional/tenant/department scope,
  departmentless fail-closed and literal-percent search witness; business giữ
  status-count/overdue summary/date-range assertions.

Created four fixture-only companions and a registry/split regression. Original
SQL, active registry and selected set 77 remain unchanged.

Verification: format, no-explicit-any, dedupe, typecheck PASS; focused suite
2/2 PASS. Oracle/live DB was not run; no aggregate DB PASS; Chunk 5/6 remain
unstarted.

The companions now keep Entry 29 audit fail-closed blocks separate from
lifecycle business blocks. Entry 31 core retains only scope invocations and
fixture witnesses; expected counts/overdue assertions remain in the business
companion. Dynamic SQL execution is still required before activation.
