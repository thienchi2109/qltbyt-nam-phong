# CLAUDE.md

AI guidance for Vietnamese Medical Equipment Management System (multi-tenant healthcare app).

---

# 🔒 SECURITY MODEL - MANDATORY READING

<SECURITY_CRITICAL>

## ⛔ ABSOLUTE RULES - VIOLATION = SECURITY BREACH

| NEVER DO THIS | WHY |
|---------------|-----|
| Direct Supabase table access | Bypasses tenant isolation |
| Trust client-supplied `p_don_vi` | Client can lie about tenant |
| Use `supabase.from('table')` | No tenant enforcement |
| Skip RPC whitelist | Exposes unauthorized functions |
| Use `any` type | Hides security bugs |
| Bypass `/api/rpc/[fn]` proxy | No JWT signing, no tenant override |

## ✅ REQUIRED: RPC-Only Architecture

**ALL database access MUST go through:**
```
Client → callRpc() → /api/rpc/[fn] → Supabase PostgREST → RPC Function
```

**Why this matters:**
1. Proxy validates NextAuth session
2. Proxy forcibly overrides `p_don_vi` for non-global users (they CANNOT choose tenant)
3. Proxy signs JWT with claims: `{app_role, don_vi, user_id, dia_ban_id}`
4. RPC functions extract claims and enforce boundaries

**Critical files:**
- `src/app/api/rpc/[fn]/route.ts` - The security gateway
- `src/lib/rpc-client.ts` - Client wrapper (`callRpc`)

## RPC Function Security Template

```sql
CREATE OR REPLACE FUNCTION fn_name(p_param TYPE, p_don_vi TEXT DEFAULT NULL)
RETURNS return_type LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
BEGIN
  -- 1. Permission check
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- 2. Tenant isolation (CRITICAL: override client parameter)
  IF v_role NOT IN ('global', 'regional_leader') THEN
    p_don_vi := v_don_vi;  -- Force user's tenant
  END IF;

  -- 3. Business logic with p_don_vi filter
  RETURN QUERY SELECT * FROM table WHERE don_vi_id = p_don_vi::int;
END;
$$;
GRANT EXECUTE ON FUNCTION fn_name TO authenticated;
```

## Adding New RPC Functions

1. Create function with tenant isolation (template above)
2. Add to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
3. Grant execute permission
4. Use via `callRpc({ fn: 'fn_name', args: {...} })`

## Roles & Tenant Access

| Role | Tenant Access | Notes |
|------|--------------|-------|
| `global` | All tenants | Full admin access (`admin` is alias) |
| `regional_leader` | Multi-tenant in region | **Read-only**, limited by `dia_ban_id` |
| `to_qltb` | Single tenant | Equipment team - full tenant operations |
| `technician` | Single tenant + dept | Technical staff, department restricted |
| `qltb_khoa` | Single tenant + dept | Department equipment manager |
| `user` | Single tenant | Basic read access |

> ⚠️ **`admin` = `global` alias — ALWAYS normalize!**
>
> The RPC proxy (`/api/rpc/[fn]`) auto-normalizes `admin` → `global` before signing JWT.
> **Outside the proxy** (standalone API routes, Edge Functions, server utilities), the session
> still contains the raw `admin` role. You MUST use `isGlobalRole()` from `@/lib/rbac` instead
> of `role === 'global'`. Checking `role === 'global'` alone **silently excludes admin users**
> from tenant-bypass logic, causing data-empty responses.

📖 **Full RBAC Documentation:** See [`docs/RBAC.md`](docs/RBAC.md) for complete permission matrices, role hierarchy diagrams, and implementation patterns.

</SECURITY_CRITICAL>

---

<!-- OPENSPEC:START -->
## OpenSpec

Open `@/openspec/AGENTS.md` for: planning/proposals/specs, breaking changes, architecture shifts, security/performance work.
<!-- OPENSPEC:END -->


<!-- CONTEXT-ENGINEERING:START -->
## Context Engineering

Invoke `context-engineering` skill for: agent systems, token optimization (>70%), memory systems, tool design, subagent workflows (>5 tasks).

**Thresholds:** 70% tokens = warning, 80% = compact. **Strategy:** Write → Select → Compress → Isolate.
<!-- CONTEXT-ENGINEERING:END -->

---

## Required Commands

| Command | When to Use |
|---------|-------------|
| `/ultra-think` | Complex decisions, architecture choices, trade-off analysis, multi-perspective problems |
| `/generate-tests` | After implementing features or fixing bugs - generate comprehensive tests |
| `/next-best-practices` | **AUTO-INVOKE** when writing/reviewing Next.js App Router code, route handlers, metadata, error files, middleware/proxy, RSC boundaries, async request APIs, or Next.js optimizations |
| `/react-best-practices` | **AUTO-INVOKE** when writing/reviewing React components, hooks, data fetching, or optimizing performance |
| `/web-design-guidelines` | When reviewing UI code for accessibility, UX, or design compliance |
| `/prd` | Create or update a PRD before Ralph execution |
| `/ralph` | Convert PRD markdown to `prd.json` for Ralph |

## Ralph Flow (Claude Code/Codex Execution Contract)

Use this workflow whenever user requests Ralph flow or execution from `prd.json`.

### A) Planning + Conversion

1. Create/align PRD first (`docs/` and/or `tasks/` per user request) using `/prd`.
2. Convert approved PRD to root `prd.json` using `/ralph`.
3. In `prd.json`, enforce:
   - `Typecheck passes` for every story
   - `Tests pass` for every story
   - UI stories use `Manual browser verification completed` (no `dev-browser` dependency required)
4. Keep stories one-iteration sized and dependency-ordered.

### B) Ralph Iteration Loop (one story at a time)

1. Read `prd.json` and `progress.txt` (`## Codebase Patterns` first). If `progress.txt` does not exist, initialize it with:
   - `## Codebase Patterns`
   - `## Progress Log`
2. Ensure current branch matches `prd.json.branchName`; checkout/create from `main` if needed.
3. Select highest-priority story with `passes: false`.
4. Implement only that story.
5. Run quality gates (typecheck/lint/test as required by project).
6. If green:
   - Commit all related changes with: `feat: [Story ID] - [Story Title]`
   - Set that story `passes: true` in `prd.json`
   - Append progress to `progress.txt` (append-only)
7. Add reusable patterns to top `## Codebase Patterns` in `progress.txt` when discovered.
8. Update nearby `CLAUDE.md` with reusable module-level guidance only (no temporary story notes).
9. For UI work: verify in browser if tooling is available; otherwise explicitly note manual verification status.

### C) Progress Entry Format (append-only)

```text
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Learnings for future iterations:
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

### D) Stop Condition

- Complete exactly one story per iteration.
- If all stories have `passes: true`, return `<promise>COMPLETE</promise>`.

## MCP Tools

**Code Search:** `mcp__filesystem-with-morph__warpgrep_codebase_search` (NEVER grep/ripgrep)
**File Editing:** `mcp__filesystem-with-morph__edit_file` (NEVER full rewrites)
**Docs:** Context7 MCP for library documentation (including Supabase docs)

## GKG Known Issue (2026-02-27)

In this environment, GitLab Knowledge Graph (GKG) can miss many `.tsx` React component definitions even after re-indexing.

Required workflow when symbols are unexpectedly missing:
1. Re-index once.
2. Re-run definition search for the exact symbol.
3. If still missing, treat GKG as incomplete for that symbol and switch to fallback:
   - `warpgrep` for semantic discovery
   - `rg` for exact definition/usage checks
   - direct file reads for final verification
4. Explicitly state in handoff/response that fallback was used due incomplete GKG results.

<!-- SUPABASE-CLI:START -->
## Supabase CLI + MCP (Hybrid Approach)

Use CLI for schema operations, MCP for SQL execution.

| Task | Tool | Command |
|------|------|---------|
| **Execute SQL** | MCP | `mcp__supabase__execute_sql` |
| **Generate types** | CLI | `node scripts/npm-run.js run db:types` |
| **DB stats** | CLI | `node scripts/npm-run.js run db:stats` |
| **Table stats** | CLI | `node scripts/npm-run.js npx supabase inspect db table-stats --linked` |
| **Index stats** | CLI | `node scripts/npm-run.js npx supabase inspect db index-stats --linked` |
| **List migrations** | CLI | `node scripts/npm-run.js npx supabase migration list` |
| **List projects** | CLI | `node scripts/npm-run.js npx supabase projects list` |

> **Note:** Migration push/pull requires synced history. Use MCP `apply_migration` for DDL changes when drift exists.
> **Windows:** Always use `node scripts/npm-run.js` wrapper for npm/npx commands to capture output.
<!-- SUPABASE-CLI:END -->

---

## Project Overview

**Stack:** Next.js 15 (App Router) • React 18 • TypeScript (strict) • Supabase (PostgreSQL) • NextAuth v4 • TanStack Query v5 • Tailwind + Radix UI

**Deploy:** Vercel (primary) • Cloudflare Pages (edge)

## Commands

```bash
npm run dev          # Dev (port 3000)
npm run build        # Production build
npm run lint         # ESLint
```

### Windows Shell Output Fix (REQUIRED)

On Windows, `npm` and `npx` commands don't return stdout properly. **Always use the helper scripts:**

```bash
# Universal helper for ANY command (npm, npx, bd, etc.)
node scripts/run-cmd.js <command> [args...]

# npm/npx specific helper
node scripts/npm-run.js run typecheck    # Typecheck (REQUIRED before commits)
node scripts/npm-run.js run build        # Build with output
node scripts/npm-run.js run lint         # Lint with output
node scripts/npm-run.js run test:run     # Run tests
node scripts/npm-run.js npx <command>    # Any npx command

# Shortcut scripts
npm run n:typecheck   # Typecheck
npm run n:build       # Build
npm run n:lint        # Lint
npm run n:test        # Tests
```

**Helper scripts:**
- `scripts/run-cmd.js` - Universal helper for any CLI command
- `scripts/npm-run.js` - Specialized helper for npm/npx commands

**Why:** `.cmd` batch files and some `.exe` files don't return stdout in certain shell contexts (Claude Code's Bash tool). These helpers use Node's `child_process.execSync` to properly capture output.

### React Doctor: True Full Scan (Non-Diff)

React Doctor can auto-scan only branch/current changes in non-interactive mode. To force a true full-repo scan, temporarily set `diff: false`:

```powershell
$cfg = "react-doctor.config.json"
Set-Content -Path $cfg -Value '{"diff": false}' -Encoding utf8
try {
  node scripts/npm-run.js npx react-doctor@latest . --verbose --yes --project nextn --no-ami
} finally {
  Remove-Item $cfg -Force -ErrorAction SilentlyContinue
}
```

For score-only full scan:

```bash
node scripts/npm-run.js npx react-doctor@latest . --score --yes --project nextn --no-ami
```

Do not rely on default `react-doctor` scripts when full-scan metrics are required.

## File Structure

```
src/
├── app/(app)/           # Protected routes (equipment, repairs, transfers, etc.)
├── app/api/rpc/[fn]/    # 🔒 CRITICAL: RPC security gateway
├── auth/config.ts       # NextAuth JWT config
├── components/          # 117+ components (ui/42 Radix)
├── hooks/               # 25 hooks
├── lib/rpc-client.ts    # 🔒 callRpc wrapper
└── middleware.ts        # Route protection

supabase/migrations/     # 154 SQL migrations
```

## Component Architecture (RepairRequests Pattern)

For complex modules with multiple dialogs:

```
module/
├── _components/
│   ├── ModuleContext.tsx       # State, mutations, dialog actions
│   ├── ModulePageClient.tsx    # Smart container
│   ├── ModuleTable.tsx         # Presentational
│   └── Module*Dialog.tsx       # Self-contained (0 props, uses context)
├── _hooks/useModuleContext.ts  # Consumer hook
└── types.ts
```

**Principles:** Context for shared state • Local form state in dialogs • useMemo on context value • useCallback on actions

<!-- REACT-SKILLS:START -->
## React/Next.js Skills (Auto-Invoke)

<IMPORTANT>
When working on React/Next.js code, PROACTIVELY invoke these skills:
- **Invoke `/next-best-practices` first** for Next.js framework concerns (App Router conventions, routes/layouts/pages, route handlers, metadata/error files, middleware/proxy, RSC boundaries, async APIs, image/font/script/bundling).
- **Invoke `/react-best-practices`** for React component architecture, hooks, rendering behavior, and re-render/performance guidance.
- For Next.js tasks that include substantial component logic, invoke both in order: `/next-best-practices` then `/react-best-practices`.

Reference installed skills:
- `C:\Users\PC\.codex\skills\next-best-practices\`
- `C:\Users\PC\.codex\skills\vercel-react-best-practices\`
</IMPORTANT>
<!-- REACT-SKILLS:END -->

## Data Fetching

**TanStack Query v5 ONLY** - Never useState for server data.

```typescript
const { data } = useQuery({
  queryKey: ['items', { don_vi }],
  queryFn: () => callRpc({ fn: 'item_list', args: { p_don_vi: don_vi } }),
  enabled: !!don_vi
})
```

## Database

**Tables:** `nhan_vien` (users) • `don_vi` (tenants) • `dia_ban` (regions) • `thiet_bi` (equipment) • `khoa_phong` (departments) • `yeu_cau_sua_chua` (repairs) • `yeu_cau_luan_chuyen` (transfers)

**No RLS** - Security via RPC functions only.

**Project ID**: cdthersvldpnlbvpufrr

## Conventions

- **Imports:** `@/*` alias, order: React → 3rd-party → `@/components` → `@/lib`
- **Types:** Never `any`, explicit interfaces, DB types in `src/types/database.ts`
- **Files:** **350-line extraction threshold.** When a file approaches ~350 lines, proactively extract logical chunks (helpers, sub-components, types, constants) into separate files. Hard ceiling: **450 lines** — no file should exceed this. When splitting, follow the module prefix naming convention (`{ModuleName}{Chunk}.tsx`).
- **UI:** Radix + Tailwind, mobile-first, react-hook-form + zod


### UI Layering Contract (MANDATORY)

- Shared overlay z-index tiers are defined in `docs/frontend/layering.md`.
- Do not add ad-hoc `z-[...]` values for modal/overlay primitives without updating that document.
- If you change overlay tiers, update/add regression tests (at minimum `src/components/ui/__tests__/alert-dialog-z-index.test.tsx`).

### Git Commands: Quote Paths with Special Characters

**ALWAYS quote file paths containing parentheses, brackets, or spaces in git commands:**

```bash
# ✅ CORRECT - quoted paths
git add "src/app/(app)/device-quota/file.tsx"
git diff "src/app/(app)/some-file.ts"

# ❌ WRONG - unquoted paths cause shell parsing errors
git add src/app/(app)/device-quota/file.tsx
```

**Why:** Next.js App Router uses `(group)` folders. Unquoted parentheses are interpreted as shell subshells, causing syntax errors.

### File Naming: Grep-Friendly Prefixes (MANDATORY)

**All new files MUST use module prefix for AI agent discoverability:**

```
✅ CORRECT (grep-friendly)          ❌ WRONG (generic)
RepairRequestsTable.tsx             Table.tsx
RepairRequestsContext.tsx           Context.tsx
RepairRequestsEditDialog.tsx        EditDialog.tsx
TransfersApprovalFlow.tsx           ApprovalFlow.tsx
EquipmentBulkImport.tsx             BulkImport.tsx
MaintenanceScheduler.tsx            Scheduler.tsx
useRepairRequestsContext.ts         useContext.ts
```

**Why:** `grep RepairRequests` finds ALL related files instantly. Generic names like `Table.tsx` or `Context.tsx` are ambiguous across modules.

**Pattern:** `{ModuleName}{ComponentType}.tsx`
- Module: RepairRequests, Transfers, Equipment, Maintenance, Users, etc.
- Type: Table, Toolbar, Context, Dialog, Sheet, List, Form, etc.

## Session Completion

```bash
git pull --rebase && git push
```

**Work is NOT complete until `git push` succeeds.**

## Priority

1. Security 2. Data Integrity 3. Type Safety 4. Performance 5. Maintainability


## SQL Code Generation Checklist

Before finalizing any data-access code, verify each item:
QUERY REVIEW CHECKLIST
──────────────────────
[ ] No N+1: related data fetched in a single query (JOIN / eager load / IN clause)
[ ] No SELECT *: only required columns are fetched
[ ] Pagination applied: all list endpoints have limit/offset or cursor
[ ] Indexes noted: filtered/sorted/joined columns have or need an index
[ ] Transactions used: multi-table writes are wrapped
[ ] Connection managed: using pool or singleton client, not per-request instantiation
[ ] Errors handled: try/catch present, no raw DB errors exposed to client
[ ] Caching flagged: read-heavy queries noted as cache candidates if appropriate
[ ] Query log verified: no duplicate/repetitive queries for a single request

## SQL Migration Safety Rules (MANDATORY)

### LIKE/ILIKE Sanitization

**NEVER concatenate user input directly into LIKE/ILIKE patterns.** Always use `_sanitize_ilike_pattern()`:

```sql
-- ❌ BAD: raw concatenation — `_` and `%` act as wildcards
v_search_pattern := '%' || COALESCE(LOWER(TRIM(p_search)), '') || '%';

-- ✅ GOOD: use deployed helper (returns NULL for NULL/empty input)
v_sanitized_search := public._sanitize_ilike_pattern(LOWER(TRIM(p_search)));
-- Then use: ... LIKE '%' || v_sanitized_search || '%'
```

### SECURITY DEFINER Functions

All `SECURITY DEFINER` functions MUST set `search_path`:

```sql
CREATE OR REPLACE FUNCTION public.fn_name(...)
RETURNS ... LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- ← MANDATORY
AS $$ ... $$;
```

### JWT Claim Guards

All authenticated RPCs MUST validate JWT claims before executing business logic:

```sql
-- Extract and validate claims
v_role := current_setting('request.jwt.claims', true)::json->>'app_role';
v_user_id := current_setting('request.jwt.claims', true)::json->>'user_id';
IF v_role IS NULL OR v_role = '' THEN
  RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
END IF;
```

### Post-Migration Verification

After applying any migration, run `get_advisors(security)` via Supabase MCP to catch regressions.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence (CLI)

This project is indexed by GitNexus as **qltbyt-nam-phong-new** (2936 symbols, 6710 relationships, 178 execution flows). Use the GitNexus **CLI** (not MCP) to understand code, assess impact, and navigate safely.

> **GitNexus MCP is NOT available in Antigravity.** Use CLI commands via terminal instead.

## CLI Binary

On this machine, `npx gitnexus` is intercepted by a batch wrapper. Use the local binary directly:

```powershell
# Alias for convenience (set GN in your session)
$GN_NODE = "C:\Users\PC\AppData\Local\Programs\gitnexus-node20\node-v20.20.1-win-x64\node.exe"
$GN_CLI  = "C:\Users\PC\AppData\Local\Programs\GitNexus\gitnexus\dist\cli\index.js"

# Run any gitnexus command:
& $GN_NODE $GN_CLI <command> [args] --repo qltbyt-nam-phong-new
```

## Commands Quick Reference

| Command | When to use | Example |
|---------|-------------|---------|
| `query "<concept>"` | Find code by concept | `query "soft delete equipment" --repo qltbyt-nam-phong-new` |
| `context "<symbol>"` | 360° view: callers, callees, processes | `context "useEquipmentTable" --repo qltbyt-nam-phong-new` |
| `impact "<symbol>"` | Blast radius before editing | `impact "useEquipmentTable" --repo qltbyt-nam-phong-new` |
| `cypher "<query>"` | Custom graph queries (read-only) | `cypher "MATCH (n) RETURN n LIMIT 10" --repo qltbyt-nam-phong-new` |
| `analyze` | Re-index after code changes | Run from repo root |
| `status` | Check index freshness | Run from repo root |
| `list` | List all indexed repos | — |

## Always Do

- **MUST run `impact` before editing any symbol.** Report blast radius (direct callers, processes, risk level) to the user.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding.
- When exploring unfamiliar code, use `query` to find execution flows grouped by process.
- When you need full context on a symbol, use `context` for callers/callees/process participation.

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Keeping the Index Fresh

```powershell
# Re-index after committing code changes (run from repo root)
& $GN_NODE $GN_CLI analyze
```

## Important Notes

- `--repo qltbyt-nam-phong-new` is **required** when multiple repos are indexed
- GitNexus indexes TypeScript/JavaScript symbols well but **does not index SQL function names** — use grep for SQL RPC functions
- `cypher` queries are **read-only** (no CREATE/DELETE/SET)
<!-- gitnexus:end -->

