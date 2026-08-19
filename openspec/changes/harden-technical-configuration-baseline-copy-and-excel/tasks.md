## Delivery Rules

- This change has exactly two implementation phases and exactly two implementation PRs.
- Phase 1 is backend-first and contains no mounted user-visible copy action.
- Phase 2 starts only after Phase 1 is merged, its migration is explicitly authorized
  and applied through Supabase MCP, and all three RPCs are verified available.
- Every behavior change is implemented test-first.
- No task may weaken dossier/baseline/revision binding for XLSX import.
- No applied migration may be edited, renamed, deleted, or repaired in place.

## Phase 1 / PR 1 - Cross-Dossier Copy Backend

Deploy boundary: additive migration and RPC proxy reachability only. Existing
frontend behavior remains unchanged and no client calls the new RPCs.

- [ ] 1.1 Reconfirm current live lineage constraints, copy function definitions,
      grants, source aggregate counts, and target draft invariants through read-only
      Supabase MCP.
- [ ] 1.2 Write failing migration-source tests for the additive source-list, preview,
      apply, auth, revision, confirmation, lineage, and aggregate-boundary contracts.
- [ ] 1.3 Freeze and test the exact wire contract from `contracts.md`, including named
      parameters, paired-null rules, pagination bounds/order, response envelopes,
      preview fingerprint, and stable error codes.
- [ ] 1.4 Write a failing SQL phase gate covering authorization, bounded source
      listing with archived locked sources but no target/editable sources, create-draft
      apply, confirmed replacement, stale revisions/fingerprints, copy identity/lineage,
      excluded domains, same-dossier compatibility, and atomic rollback.
- [ ] 1.5 Add one correctly ordered append-only migration that supersedes the lineage
      invariant and defines the source-list, preview, and apply RPCs frozen in
      `contracts.md`.
- [ ] 1.6 Preserve the repository's `SECURITY DEFINER`, fixed `search_path`, JWT claim,
      explicit grant/revoke, active-target-dossier, locked-source, and optimistic
      revision patterns.
- [ ] 1.7 Implement set-based copy maps for the complete baseline-owned aggregate and
      set target `next_criterion_number` after all copied criterion codes.
- [ ] 1.8 Preserve target suppliers, options, option documents, and comparison-set
      roots during replacement; count and atomically delete criterion-scoped option
      responses, option citations, and manual assessments.
- [ ] 1.9 Generate a versioned canonical preview fingerprint from every copied,
      deleted, and preserved row; require apply to lock the target dossier row, acquire
      the canonical `SHARE ROW EXCLUSIVE ... NOWAIT` table-lock sequence, then
      recompute and match the fingerprint before mutation.
- [ ] 1.10 Assert create and replacement coverage for every copied, deleted, preserved,
      and excluded entity class named by the spec.
- [ ] 1.11 Add a two-session concurrency phase gate proving that a dependent child-row
      writer already holding a conflicting lock causes fail-fast
      `concurrent_write_retry`, while a writer starting after apply acquires all locks
      waits until commit; prove no partial mutation or deadlock wait-cycle.
- [ ] 1.12 Add the three RPCs to the RPC proxy allowlist and add focused route/contract
      tests without adding a user-visible frontend caller.
- [ ] 1.13 Run candidate-commit database gates and report `static` and
      `baseline-forward` separately. Aggregate PASS requires both lanes for that
      candidate commit.
- [ ] 1.14 Run applicable formatting, explicit-any, dedupe, typecheck, focused tests,
      and diff-only React Doctor gates for changed TypeScript files.
- [ ] 1.15 Open PR 1 with the deploy boundary and rollback notes. Merge before any
      Phase 2 branch work starts.
- [ ] 1.16 After merge, sync the exact landed main commit and rerun both database lanes
      against that SHA. Retain readable digest-bearing evidence for both PASS results.
- [ ] 1.17 Ask for explicit permission for this specific live database write only
      after the landed-commit gates pass. After approval, apply only the reviewed
      migration through Supabase MCP, then run security advisors and focused read-only
      RPC verification.

## Phase 2 / PR 2 - Frontend Copy Workflow And Excel Hardening

Depends on: Phase 1 merged and the three RPCs verified in the target environment.

Deploy boundary: mount the target-side workflow and correct existing XLSX behavior;
no database migration is introduced in this PR.

- [x] 2.1 Branch from updated main after Phase 1 deployment and generate/define client
      types directly from the frozen `contracts.md` wire shapes.
- [x] 2.2 Write failing client/data-hook tests for paginated locked-source search,
      preview states, stale conflicts, create-draft apply, replacement confirmation,
      preview fingerprint, dependent-data deletion counts, cancellation, and
      mutation-cache refresh.
- [x] 2.3 Add `Sao chép từ hồ sơ khác` on the target dossier baseline surface while
      preserving the existing `Sao chép thành bản nháp` action.
- [x] 2.4 Build a bounded source selector that displays device type, dossier name,
      archive state, and locked version; exclude the target dossier and do not issue
      per-dossier version requests.
- [x] 2.5 Show the locked-source warning when the copy workflow opens and keep draft
      versions out of the selectable result set.
- [x] 2.6 Render authoritative preview, including all dependent deletion counts.
      Require explicit full-replacement confirmation only when the backend reports an
      existing target draft, and preserve dialog state after recoverable stale/server
      errors.
- [x] 2.7 Carry the returned preview fingerprint into apply and force a fresh preview
      after `stale_preview` or `concurrent_write_retry`.
- [x] 2.8 Write a failing regression test using real serialized XLSX bytes for:
      download current configuration -> upload the same unchanged file -> accepted
      preview with no false identity errors.
- [x] 2.9 Change client identity validation so syntax, duplicates, and hierarchy shape
      remain local checks while live membership/ownership is decided by server preview.
- [x] 2.10 Suppress dependent missing-parent cascades after a structural identity error
      while retaining physical-row errors for independent failures.
- [x] 2.11 Write filename tests for the exact normalization, fallback, 60-character
      dynamic-segment caps, and 160-character final cap in the spec.
- [x] 2.12 Generate
      `{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx` and
      `Mau_{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx` from the tested helper.
- [x] 2.13 Add a serialized-XLSX round-trip regression through the production
      download/upload adapters: generate the current configuration bytes, upload the
      unchanged bytes through hierarchy import, and reach an error-free authoritative
      preview.
- [x] 2.14 Add RTL/data-hook integration acceptance for cross-dossier copy into a target
      with no draft, including warning, source search, preview, apply, and target refresh.
- [x] 2.15 Add RTL/data-hook integration acceptance for replacing an existing draft,
      including dependent deletion counts, explicit confirmation, cancel-without-mutation,
      stale-preview recovery, and successful apply.
- [x] 2.16 Verify cross-dossier workbook upload is still rejected and directs the user
      to server-side copy rather than remapping foreign hidden IDs.
- [x] 2.17 Run format, explicit-any, dedupe, typecheck, focused Vitest/RTL tests,
      and diff-only React Doctor in repository order.
- [x] 2.18 Open PR 2 against updated main with Phase 1 deployment evidence and complete
      the user-visible acceptance flow through focused RTL integration coverage; the repo
      does not currently provide a browser harness for viewport-level desktop/mobile runs.
