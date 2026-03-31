# Lint Baseline Track Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop pull requests from being blocked by known full-repo lint debt while keeping that debt visible and tracked under issue `#140`.

**Architecture:** Keep PR workflows focused on diff-safe verification that matches the repo's existing TypeScript/React review policy, and move repo-wide lint into a dedicated baseline workflow that runs independently. Record the process change on issue `#140` so cleanup remains explicit.

**Tech Stack:** GitHub Actions workflows, GitHub Issues, Next.js repo scripts, bash

---

## Chunk 1: Workflow Separation

### Task 1: Update PR workflows

**Files:**
- Modify: `.github/workflows/deploy-dual.yml`
- Modify: `.github/workflows/preview-deploy.yml`

- [x] Replace `npm run lint` with `node scripts/npm-run.js run verify:no-explicit-any`, keeping `npm run typecheck`.
- [x] Confirm deployment/build steps remain unchanged.

## Chunk 2: Baseline Lint Track

### Task 2: Add a dedicated baseline workflow

**Files:**
- Create: `.github/workflows/lint-baseline.yml`

- [x] Add `workflow_dispatch` and weekday `schedule` triggers.
- [x] Run full-repo `npm run lint`.
- [x] Write a step summary that links baseline debt to issue `#140`.

## Chunk 3: Verification And Tracking

### Task 3: Verify YAML and update issue tracking

**Files:**
- Modify: `.gitignore`
- External: GitHub issue `#140`

- [x] Unignore tracked workflow files under `.github/workflows/*.yml` so new workflow files can be committed.
- [x] Parse all changed workflow YAML locally.
- [ ] Comment on issue `#140` with the new process split.
- [ ] Commit and push the branch.
