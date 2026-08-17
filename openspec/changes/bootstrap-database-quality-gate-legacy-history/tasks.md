## 0. Delivery Rules

- [ ] Work from the landed Phase 4 `main` commit on a dedicated bootstrap
      branch.
- [ ] Do not edit, rename, delete, reorder, repair, or replay legacy migration
      files line-by-line.
- [ ] Do not write live Supabase, modify `qltbyt_test`, apply a migration, add
      CI/rulesets, or enable a timer without separate explicit authorization.
- [ ] Keep unavailable authority/evidence as INCOMPLETE and unexplained
      attestation differences as BLOCKING. Do not claim aggregate PASS until
      all required dynamic evidence exists.

## 1. RED Contracts

- [ ] Add failing tests for strict bootstrap-manifest parsing, canonical SQL
      hashing, exact cutover binding, ordered inventory digest, and rejected
      synthetic version mappings.
- [ ] Add failing tests proving fresh replay restores bootstrap SQL before only
      post-cutover 14-digit migrations.
- [ ] Add failing tests proving baseline-forward ignores un-mappable legacy
      Oracle versions and selects only explicit post-cutover pending entries.
- [ ] Add failing tests for missing artifact/authority/evidence as INCOMPLETE
      and unexplained three-way fingerprint differences as BLOCKING.

## 2. Offline Implementation

- [ ] Implement manifest and artifact validation without reading mutable
      worktree inputs.
- [ ] Generate and validate the legacy path-and-SHA inventory plus aggregate
      digest at the exact protected cutover.
- [ ] Extend dynamic lane inputs, executor contract, report invalidation keys,
      fresh replay, and baseline-forward selection for bootstrap behavior.
- [ ] Update runbook with schema-only dump command, scope review, manifest
      creation, three-way attestation, cleanup verification, and no-live-write
      boundary.

## 3. Artifact Generation and Exact-Main Validation

- [ ] Obtain separate explicit authority for a read-only `qltbyt_test`
      schema-only dump and, if required, a read-only live catalog attestation.
- [ ] Generate raw dump and manifest; verify toolchain, scope, canonical hash,
      inventory digest, and evidence digests before committing.
- [ ] Land the bootstrap implementation and artifact separately from Phase 4.
- [ ] Run fresh replay and baseline-forward only on disposable Oracle databases
      for the exact landed `main` SHA; verify cleanup and immutable reports.
- [ ] Keep the result BLOCKING or INCOMPLETE until all required evidence
      passes; enable no schedule in this change.
