# React Doctor Manual Integration Design

## Context
- Project stack: Next.js 15 + React 18 + TypeScript.
- Requirement: integrate React Doctor in a **manual-only** workflow (no CI automation).
- Constraint: keep changes minimal and localized.

## Goal
Provide a simple, repeatable way for developers to run React Doctor locally from this repository.

## Selected Approach
### Option Chosen: NPM scripts only
Add dedicated scripts in `package.json` so developers can run React Doctor consistently without memorizing CLI flags.

### Why this option
- Keeps onboarding friction low.
- Avoids extra maintenance from CI or additional config files.
- Preserves flexibility to add config later only if needed.

## Scope
### Files to modify
- `package.json` (scripts section only)

### Scripts to add
- `react-doctor`: `npx -y react-doctor@latest .`
- `react-doctor:verbose`: `npx -y react-doctor@latest . --verbose`
- `react-doctor:score`: `npx -y react-doctor@latest . --score`

## Runtime/Data Flow
1. Developer runs one of the new npm scripts.
2. npm executes `npx -y react-doctor@latest` against the project root.
3. React Doctor detects framework and analyzes code.
4. Output (score + diagnostics, depending on flags) is shown in terminal for manual remediation.

## Error Handling
- If network/package download fails, rerun command later.
- No production/runtime impact because this is dev tooling only.

## Verification Plan
Run the following commands and verify expected behavior:

1. `node scripts/npm-run.js run react-doctor:score`
   - Expected: command exits successfully and prints score output.
2. `node scripts/npm-run.js run react-doctor`
   - Expected: diagnostics summary and score output.
3. `node scripts/npm-run.js run react-doctor:verbose`
   - Expected: diagnostics include file and line-level details.

## Out of Scope
- GitHub Actions integration
- Repository-level `react-doctor.config.json`
- Auto-fix (`--fix`) workflow

## Full-Repo Scan Findings (2026-02-25)
Detailed scan results were extracted to:
- `docs/react-doctor-full-scan-2026-02-25.md`
