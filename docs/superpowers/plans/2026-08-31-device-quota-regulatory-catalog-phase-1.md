# Device Quota Regulatory Catalog Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the immutable, traceable Thong tu 10/2026 regulatory catalog foundation and its guarded read-only RPC without changing draft, active quota, equipment, compliance, report, or Excel-import behavior.

**Architecture:** Add a forward-only Supabase migration with normalized regulatory document, catalog version, section, item, rule, source-position, source-page, and reference tables. Seed the canonical ready snapshot from the checked-in Phase 0 JSON/manifest embedded in the migration, validate cross-table completeness before making the version immutable, and expose one authenticated snapshot RPC that returns the source-order contract. Keep all new tables inaccessible through direct client privileges and enforce JWT role/user/unit guards inside `SECURITY DEFINER` functions.

**Tech Stack:** PostgreSQL/Supabase migrations and SQL phase-gate tests, Vitest source-contract tests, existing DB quality-gate registry, OpenSpec strict validation.

---

## Chunk 1: Contract Tests And Migration

### Task 1: Add failing source contract coverage

**Files:**

- Create: `tests/device-quota/regulatory-catalog-phase-1.test.ts`
- Test: `docs/device-quota/source-artifacts/thong-tu-10-2026/manifest.json`
- Test: `docs/device-quota/source-artifacts/thong-tu-10-2026/thong-tu-10-2026-appendix.json`

- [ ] Assert the Phase 1 migration exists and embeds the exact Phase 0 manifest and appendix JSON.
- [ ] Assert the migration declares only additive regulatory objects and the required read-only security clauses.
- [ ] Assert no DML/DDL targets active category, decision, equipment, or compliance tables.
- [ ] Run the focused test and confirm it fails because the migration is not present yet.

### Task 2: Implement the additive regulatory migration

**Files:**

- Create: `supabase/migrations/20260831120000_device_quota_regulatory_catalog_foundation.sql`

- [ ] Create the eight regulatory tables with foreign keys, source-order uniqueness, identity/hash/date metadata, non-null source traceability, and explicit no-direct-client-access RLS/grants.
- [ ] Add completeness validation for the frozen counts: 42 structural rows, 5 sections, 37 items, 16 child items, 21 top-level items, 3 footnotes, 37 item pages, 37 item references, and 32 multiline items.
- [ ] Seed document/version/sections/items/rules/positions/pages/references from embedded artifact JSON while preserving source order, parent relationships, multiline quota lines, and footnotes.
- [ ] Enforce one canonical ready version per document with a partial unique index and fail-closed canonical resolver.
- [ ] Add immutable regulatory row triggers and a ready-transition completeness trigger.
- [ ] Add the authenticated read-only `device_quota_regulatory_catalog_get()` RPC with app-role, user, active-account, and session-unit guards, `SECURITY DEFINER SET search_path = public, pg_temp`, and explicit execute grants.
- [ ] Run the source contract test and confirm it passes.

### Task 3: Add the database phase gate

**Files:**

- Create: `supabase/tests/device_quota_regulatory_catalog_phase_gate.sql`
- Modify: `supabase/db-quality-gate-tests.json`

- [ ] Assert schema, RLS deny policies, no direct client table privileges, canonical identity, exact completeness, immutability, function security, and execute grants.
- [ ] Exercise missing/malformed claims, unsupported roles, missing unit, mismatched unit, and one valid authenticated snapshot read.
- [ ] Register the test as `phase-gate`, `default-safe`, `isolated-fixture`, `psql`, and `rollback-required` with OpenSpec evidence.

## Chunk 2: Verification And Handoff

### Task 4: Run required verification

**Files:**

- No source changes.

- [ ] Run OpenSpec strict validation.
- [ ] Run `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`, focused Vitest tests, and `git diff --check`.
- [ ] Run the static DB quality gate and record its digest-bearing result.
- [ ] Run baseline-forward separately against the disposable Oracle gate database; do not apply the migration to live Supabase.
- [ ] Review the final diff for Phase 2+ scope creep and confirm active/Excel/#928 files are untouched.
- [ ] Commit and push the branch, then report static and baseline-forward lanes separately.
