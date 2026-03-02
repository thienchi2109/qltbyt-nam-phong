# Knip Warning Remediation Plan (React Doctor Full Scan 2026-02-25)

## Context
The full React Doctor scan shows dead/redundant code as the largest warning bucket:
- `knip/exports`: 128
- `knip/types`: 120
- `knip/files`: 55
(see `D:/qltbyt-nam-phong/docs/react-doctor-full-scan-2026-02-25.md:55-58`)

In this repo, knip is surfaced through React Doctor categories (no standalone knip config/script in `package.json`), so remediation should be driven by safe, incremental code cleanup and verified with React Doctor + project quality gates.

Goal: reduce knip warnings substantially without breaking runtime behavior, test mocks, or route conventions.

Scope decision for this execution cycle: **only Phase 1 (unused re-exports)**. All later phases are intentionally deferred for a separate, safety-reviewed pass.

## Recommended Approach

### Phase 0 — Establish baseline and triage inventory
1. Re-run a true full scan (non-diff) and capture fresh diagnostics.
   - Confirmed strategy: run this full scan now before any cleanup, then re-run after each major phase and at final completion.
2. Build a remediation inventory focused only on current-scope category:
   - Unused re-exports (`knip/exports`)
3. Track `knip/types` and `knip/files` as reference metrics only (no remediation actions in this cycle).
4. Prioritize high-confidence, low-risk targets first (barrel export pruning before file deletion).

Why first: this creates a deterministic “before/after” baseline and avoids deleting files blind.

### Phase 1 — Prune unused barrel exports (highest ROI, low risk)
Focus on removing unused re-export lines, not implementation files yet.

Initial targets:
- `D:/qltbyt-nam-phong/src/app/(app)/equipment/_hooks/index.ts`
- `D:/qltbyt-nam-phong/src/components/bulk-import/index.ts`
- `D:/qltbyt-nam-phong/src/components/onboarding/index.ts`
- `D:/qltbyt-nam-phong/src/components/shared/DataTablePagination/index.ts`

Execution pattern:
1. For each export in target barrel files, search for real usage across app + tests.
2. Remove only exports with zero usage.
3. Keep implementation files untouched in this phase.
4. Validate after each small batch (5–15 export removals max).

### Deferred Phases (not in current scope)
The following are explicitly deferred until Phase 1 is complete and reviewed:

- Phase 2: prune unused type exports (`knip/types`)
- Phase 3: remove orphan files (`knip/files`)
- Phase 4: broader module sweeps
- Phase 5: final full dead-code closure report

No file deletions or type-surface cleanup should be done in this cycle.

## Critical Files to Modify
(Current cycle: Phase 1 only)
- `D:/qltbyt-nam-phong/src/app/(app)/equipment/_hooks/index.ts`
- `D:/qltbyt-nam-phong/src/components/bulk-import/index.ts`
- `D:/qltbyt-nam-phong/src/components/onboarding/index.ts`
- `D:/qltbyt-nam-phong/src/components/shared/DataTablePagination/index.ts`

Deferred (do not modify in this cycle):
- `D:/qltbyt-nam-phong/src/components/shared/DataTablePagination/types.ts`
- `D:/qltbyt-nam-phong/src/components/bulk-import/bulk-import-types.ts`
- Any candidate file deletions from future `knip/files` cleanup

## Existing Functions/Utilities to Reuse
- React Doctor script from `D:/qltbyt-nam-phong/package.json`:
  - `react-doctor:verbose`
- Windows-safe command wrappers:
  - `D:/qltbyt-nam-phong/scripts/npm-run.js`
  - `D:/qltbyt-nam-phong/scripts/run-cmd.js`
- Existing direct-import pattern already used in app (preferred over broad barrels for unused-surface reduction), e.g. `D:/qltbyt-nam-phong/src/app/(app)/layout.tsx` imports `@/components/onboarding/HelpButton` directly.

## Verification (End-to-End)
Run after each batch and at phase boundaries.

### Fast checks (each batch)
1. `node scripts/npm-run.js run typecheck`
2. `node scripts/npm-run.js run lint`
3. `node scripts/npm-run.js run test:run`

### React Doctor trend checks
1. Quick score:
   - `node scripts/npm-run.js npx react-doctor@latest . --score --yes --project nextn --no-ami`
2. Verbose scan:
   - `node scripts/npm-run.js run react-doctor:verbose`

### True full-scan gate (non-diff)
Use project’s documented full-scan approach:

```powershell
$cfg = "react-doctor.config.json"
Set-Content -Path $cfg -Value '{"diff": false}' -Encoding utf8
try {
  node scripts/npm-run.js npx react-doctor@latest . --verbose --yes --project nextn --no-ami
} finally {
  Remove-Item $cfg -Force -ErrorAction SilentlyContinue
}
```

Success criteria (current cycle):
- No new errors in `react-hooks/*`, `jsx-a11y/*`, or build/lint/typecheck/test.
- `knip/exports` decreases from baseline.
- `knip/types` and `knip/files` do not materially regress while Phase 1 changes are applied.

## Risk Controls / Rollback
- Do not delete implementation files in early phases.
- If any regression appears, revert the latest small batch immediately.
- Treat ambiguous items as deferred (keep code, remove only unneeded re-export if safe).
- Keep cleanup commits small so rollback is trivial.

## Out of Scope
- Refactoring business logic.
- RPC/security model changes.
- Broad architecture changes unrelated to dead code cleanup.
