# Web Push Phase 2-3 live apply 2026-09-11

Maintainer explicitly authorized applying Phase 2 then Phase 3 via Supabase MCP and bypassing the unfinished Database Quality Gate for this operation. No gate result changed to PASS, no waiver registry fabricated. Static FAILED and Oracle FAILED at source commit 219d55182a7d4299bc927048a627ba5e049e48e2 remain recorded. Tasks 2.4/3.4 remain unchecked; #998/#999 remain open.

Verified MCP target https://cdthersvldpnlbvpufrr.supabase.co. No prior Web Push migrations/tables. Applied exact committed SQL sequentially:

| Source filename                            | Live version   | Full SQL SHA256                                                  |
| ------------------------------------------ | -------------- | ---------------------------------------------------------------- |
| 20260911030000_web_push_schema.sql         | 20260911124020 | 1765de223215f147e174a90388946bc00cb3a136979f5b59fee23c3ca8e90c34 |
| 20260911030100_web_push_recipients.sql     | 20260911124027 | c51a9027308878ed12be56723a20e698e25c027eef9f4b1f750eefde87994adb |
| 20260911030200_web_push_subscriptions.sql  | 20260911124035 | f381dde51fe26448a602ba672970670571eb970dcc7c380b3c2a738c1535a943 |
| 20260911030300_web_push_atomic_enqueue.sql | 20260911124043 | 85dda37d7d650c8f9decbf5c62b2f564b7edad2e4687216f1144ea5a6e54db79 |

Each apply_migration returned success. Read-back hashes of statements[1] match full source bytes including final newline. Historical migration files unchanged; never rename to live versions.

Read-back: one runtime control row, enqueue_enabled=false; intents/subscriptions/deliveries all0. Six web_push tables have RLS enabled and no anon/authenticated direct CRUD. Internal helpers not executable by anon/authenticated; four session RPCs authenticated only; all functions pin search_path=public,pg_temp. audit_log MD5 e80f56116c05cb849ad0d1fd5045ab55 unchanged. Existing repair_request_create anon EXECUTE remains present (also observed on restored baseline before this operation); original claims guards retained. No extra privilege mutations performed.

Security advisors: Web Push 6 INFO rls_enabled_no_policy (intentional RPC-only deny-direct model), 4 WARN authenticated_security_definer_function_executable (the four authorized session RPCs). Performance: 10 INFO unused_index for new unused tables. No claim that the entire project is advisor-clean; unrelated findings not modified.

References:

- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

No fixture writes, enabling enqueue, browser/worker/provider send, app deploy or Oracle baseline refresh performed. Live apply installs DB prerequisites only; user-facing Web Push delivery is not activated. Oracle baseline is now behind these four live migrations and requires separately scoped catch-up before future baseline-dependent acceptance.

## Direct landing authorized after live apply

Maintainer subsequently requested direct landing on main, no PR, repository sync and topic cleanup. Main fast-forwards from cd9da20c through 9b5fc8af (Phase 3), 02fede27 (evidence) and 219d5518 (approved lifecycle fixture fix); no migration rewritten. This document is a separate evidence-only commit.

Lifecycle fixture passes all nine sections on baseline and Phase 3 disposable clones. Removing fault injection and injecting an unrelated error both fail as expected. The old lifecycle baselineDebt exemption was removed, not updated to hide failure. Independent review found no Critical/Important issue. Formal lanes on 219d5518: static FAILED (3 BLOCKING, 1 DANGEROUS), digest 8a6009b3f1301bb15bb172c658368c566f3e424c87d081dab97d7d1a4717507d; Oracle FAILED, 80/80 control and 80/80 candidate, lifecycle PASS, only inventory #998 blocking, digest 4ffb614fbe83b9dd55e70af8203e136bc8418583837e50339268e9fb99c30dfe.

Those reports certify only the named subject, not this evidence-only landing commit. No aggregate PASS or landed-commit certification is claimed. User-authorized push --no-verify does not change those results. Topic branches feat/web-push-phase3-atomic-enqueue and fix/999-lifecycle-audit-fixture are the cleanup targets; neither has a separate worktree. Unrelated existing worktrees and the pre-existing Lefthook stash are outside this cleanup.
