# Baseline-Forward Quality Gate Implementation Plan

1. Add a regression test proving baseline-forward does not require bootstrap
   SQL or manifest files.
2. Restrict the executable dynamic lane contract to `baseline-forward`.
3. Remove bootstrap loading, attestation, executor operations, report hashes,
   and fresh-replay control flow.
4. Keep the applied-migration lock and legacy digest as the source for pending
   migration calculation.
5. Delete bootstrap-only modules/tests plus the committed SQL and manifest.
6. Update AGENTS, CLAUDE, and Database Quality Gate OpenSpec wording.
7. Run TypeScript gates, focused/full Database Quality Gate tests, and static
   validation.
8. Commit and push directly to `main`.
9. Run static and baseline-forward on the exact landed commit; require cleanup
   and immutable digest-bearing PASS evidence before closing the issues.
