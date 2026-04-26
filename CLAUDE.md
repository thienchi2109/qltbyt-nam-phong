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

## Memori MCP Convention

Use Memori MCP as durable project memory for this repository. Do not treat it as a complete or automatic record of all prior chats.

### What to Save

- Final decisions that affect implementation or operations
- Non-obvious debugging conclusions
- Durable workflow rules and repo-specific gotchas
- Deploy, rollback, migration, or environment notes that future sessions will need

### What Not to Save

- Temporary brainstorming
- Repeated status updates
- Facts already captured clearly in code, tests, migrations, or canonical docs
- Sensitive secrets, tokens, or raw credentials

### Session Rule

When a session produces durable context, save one concise Memori MCP summary near the end of the session rather than many small notes.

### Required Note Shape

```md
# [Short title]

## Context
- Task or feature area
- Why this mattered

## Decision / Finding
- What was decided or discovered

## Evidence
- Files, commands, logs, PRs, issues, or docs that support it

## Actionable Follow-up
- What future agents should do or avoid

## Metadata
- Date: YYYY-MM-DD
- Confidence: high | medium | low
```

### Retrieval Rule

Before re-investigating a non-trivial problem, use Memori MCP `recall` to check whether relevant memory already exists. If memory conflicts with the current codebase, trust the codebase and update the memory note.


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

## Additional Skill Guidance

- The global skill `karpathy-coding-heuristics` is installed in this environment.
- For non-trivial coding, refactoring, and code review tasks, explicitly consider invoking `karpathy-coding-heuristics` to keep the work aligned with Andrej Karpathy's core heuristics:
  - surface meaningful assumptions before implementation
  - prefer the simplest sufficient solution
  - keep changes surgical and tightly scoped
  - define concrete verification before claiming success
- Treat `karpathy-coding-heuristics` as a supporting heuristic layer. It does not override repo-specific rules, security constraints, or stricter required skills such as `next-best-practices`, `vercel-react-best-practices`, debugging, TDD, or verification workflows.

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
   - For TypeScript / React diffs, run `verify:no-explicit-any` before `typecheck`.
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

**Deploy:** Vercel

## Commands

```bash
npm run dev          # Dev (port 3000)
npm run build        # Production build
npm run lint         # ESLint
```

### Windows Shell Output Fix (REQUIRED)

On Windows, `npm` and `npx` commands don't return stdout properly. **Always use the helper scripts:**

```bash
# Universal helper for ANY command (npm, npx, git, etc.)
node scripts/run-cmd.js <command> [args...]

# npm/npx specific helper
node scripts/npm-run.js run typecheck    # Typecheck (REQUIRED before commits)
node scripts/npm-run.js run verify:no-explicit-any   # Diff-aware explicit-any gate
node scripts/npm-run.js run build        # Build with output
node scripts/npm-run.js run lint         # Lint with output
node scripts/npm-run.js run test:run     # Run tests
node scripts/npm-run.js npx <command>    # Any npx command

# Shortcut scripts
npm run n:typecheck   # Typecheck
npm run n:verify:no-explicit-any   # Diff-aware explicit-any gate
npm run n:build       # Build
npm run n:lint        # Lint
npm run n:test        # Tests
```

**Helper scripts:**
- `scripts/run-cmd.js` - Universal helper for any CLI command
- `scripts/npm-run.js` - Specialized helper for npm/npx commands

**Why:** `.cmd` batch files and some `.exe` files don't return stdout in certain shell contexts (Claude Code's Bash tool). These helpers use Node's `child_process.execSync` to properly capture output.

### Verification Order (MANDATORY for `.ts` / `.tsx` changes)

Run verification in this order before claiming success, committing, or updating a PR:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused tests for the changed behavior
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

`verify:no-explicit-any` is diff-aware. It scans changed TypeScript files from the current branch diff plus staged, unstaged, and untracked files, and fails on explicit `any`. Do not rely on `typecheck` or `react-doctor` alone to catch this class of issue.

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

## Supabase CLI vs MCP (MANDATORY)

**All database operations MUST go through Supabase MCP (project `cdthersvldpnlbvpufrr`). Agents MUST NOT invoke the Supabase CLI for DB-touching operations.** The CLI binary may be installed locally for human developers; that is not permission for agents to use it.

**Forbidden for agents** (do NOT run, even via `npx`, `npm run`, scripts, or shell pipelines):

- `supabase db push` / `supabase db pull` / `supabase db reset` / `supabase db diff` / `supabase db dump`
- `supabase migration new` / `supabase migration up` / `supabase migration repair` / `supabase migration squash`
- `supabase link` / `supabase login` / `supabase projects ...` / `supabase secrets ...`
- `supabase functions deploy` / `supabase functions delete`
- `supabase inspect db ...`
- The npm script aliases: `npm run db:push`, `npm run db:pull`, `npm run db:diff`, `npm run db:migration`, `npm run db:stats` (and any future `db:*` script that wraps the CLI)

**Use Supabase MCP instead**:

- Apply migrations → `apply_migration` (MCP)
- Run SQL / inspect schema → `execute_sql`, `list_tables`, `list_extensions`, `list_migrations` (MCP)
- Generate types → `generate_typescript_types` (MCP)
- Post-migration safety → `get_advisors(security)` and `get_advisors(performance)` (MCP)
- Edge Functions → `deploy_edge_function`, `list_edge_functions` (MCP)
- Logs / debugging → `get_logs` (MCP)

**Allowed local-only CLI work** (read-only, no live DB side effects, only when explicitly required by the task):

- `supabase --version` for environment checks
- `supabase start` / `supabase stop` / `supabase status` for a fully local dev stack only when the user explicitly asks for it

If a task seems to require a forbidden CLI command, STOP and ask the user — there is almost always an MCP equivalent. Never "fall back" to the CLI silently.

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

### Migration Source Order

Before creating, renaming, or applying a Supabase migration, compare the new filename timestamp against all existing local migrations that touch the same tables, functions, triggers, policies, or grants. The local migration filename order is the source of truth for fresh DB/reset behavior.

- A migration that `CREATE OR REPLACE`s an existing function MUST sort after the latest local migration that also redefines that function.
- Do not name a local migration only to match a Supabase MCP-applied live version if that places it before existing local migrations that can overwrite it.
- If a bad-order migration has already been applied via MCP, fix the repo by adding/renaming to a correctly ordered local migration and apply a new idempotent superseding migration. Do not keep the bad-order local file and do not manually edit `supabase_migrations.schema_migrations` unless the team explicitly approves a metadata repair.

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

## 🔗 Combined Workflow: Code Review Graph + GitNexus + Memori MCP

These tools complement each other. Use them together while prioritizing token-efficient codebase reading:

| Tool | Answers | Persistence |
|------|---------|-------------|
| **Memori MCP** | WHY a decision was made, historical findings, gotchas | Persistent (survives across sessions) |
| **Code Review Graph** | WHERE to start reading, changed-file impact, compact codebase/review context | Ephemeral (per-query, reflects current code) |
| **GitNexus** | WHAT calls what, precise symbol/process relationships, required impact blast radius | Ephemeral (per-query, reflects current code) |

### Standard Session Loop

```
1. START OF SESSION
   memori: recall("feature area")
   → Retrieve prior decisions, known gotchas, architectural constraints

2. TOKEN-EFFICIENT CODEBASE READING
   code-review-graph: get_minimal_context_tool(task)
   code-review-graph: query_graph_tool(..., detail_level="minimal")
   → Compact first-pass map of relevant files/symbols

3. PRECISE SYMBOL / IMPACT ANALYSIS
   gitnexus: context("selected symbol")
   gitnexus: impact("target symbol")
   → Exact callers, callees, processes, and required blast radius before edits

4. IMPLEMENT
   Write code using the narrowed context

5. END OF SESSION
   memori: advanced_augmentation(...)
   → Save durable decisions, non-obvious findings, environment gotchas
   → Skip ephemeral brainstorming; trust code/tests for obvious facts
```

### Pattern: Investigate Before Changing

```
# Step 1 — Recall prior context (Memori MCP)
memori recall("repairRequest") → "Tách file vì vượt 350 lines (2026-04-01)"

# Step 2 — Read codebase cheaply first (Code Review Graph)
code-review-graph get_minimal_context_tool("repair request sheet flow")
code-review-graph query_graph_tool("repair request sheet", detail_level="minimal")

# Step 3 — Find precise current impact only after narrowing (GitNexus)
gitnexus impact("RepairRequestSheet") → d=1: 3 callers, d=2: 8 indirect

# Step 4 — Implement with narrowed context
# Step 5 — Save new findings back to Memori MCP
```

### When to Write a Memory Note

Write a note when you discover or decide something that a **future agent cannot easily re-derive from code alone**:
- ✅ Architectural trade-off (why X over Y)
- ✅ Non-obvious bug root cause
- ✅ Environment / deploy gotcha
- ✅ Workflow rule change
- ❌ Anything already obvious from code/tests/migrations/PRs

## GitNexus + Code Review Graph Token Strategy

Primary goal: minimize tokens when reading and understanding the codebase. Use Code Review Graph as the first-pass codebase reader, then use GitNexus only for precise symbol/process relationships and required impact analysis before edits.

### Tool Responsibilities

| Task | Use first | Why |
|------|-----------|-----|
| Broad codebase reading or unfamiliar feature discovery | Code Review Graph `get_minimal_context_tool` / `query_graph_tool` | Cheapest first-pass map of relevant files and areas |
| Review an existing diff or PR | Code Review Graph `get_minimal_context_tool` | Compact change-aware context |
| Assess changed-file blast radius | Code Review Graph `detect_changes_tool` | Diff-to-impact mapping without broad source dumps |
| Need exact callers, callees, or process participation for one symbol | GitNexus `context` | Precise symbol-level relationship graph |
| Plan edits to a narrowed symbol | GitNexus `impact` | Required caller/importer/process blast radius before non-trivial edits |
| Investigate only the riskiest changed symbols | GitNexus `impact` / `context` | Focused follow-up after Code Review Graph triage |

### Token-Saving Defaults

Code Review Graph:
- Use Code Review Graph first for broad codebase reading, architecture discovery, unfamiliar features, and existing diffs.
- Keep outputs minimal: `detail_level="minimal"`, `include_source=false`, and small limits unless the narrowed context is insufficient.
- Use `query_graph_tool` / `semantic_search_nodes_tool` with `detail_level="minimal"` and `limit<=5` for codebase reading.
- Start review/diff tasks with `get_minimal_context_tool`.
- Use `detect_changes_tool` with `detail_level="minimal"` and `include_source=false` by default.
- Use `get_review_context_tool` with `detail_level="minimal"` and `include_source=false` before escalating to source snippets.

GitNexus:
- Use GitNexus after Code Review Graph has narrowed the area, or when exact symbol/process relationships are required.
- `query`: use small limits (`limit=2-3`, `max_symbols=3-5`) and `include_content=false`.
- `context`: start with `include_content=false`; request source only when direct file reads are insufficient.
- `impact`: prefer `maxDepth=2` and `includeTests=false` unless test blast radius is explicitly needed.
- `cypher`: use only when `query`, `context`, and `impact` cannot answer the structural question.

### Combined Workflow

For broad codebase reading or unfamiliar feature discovery:

1. Start with Code Review Graph `get_minimal_context_tool` for the task.
2. Use Code Review Graph `query_graph_tool` or `semantic_search_nodes_tool` with minimal detail and small limits.
3. Read source files directly only after Code Review Graph narrows the target files/symbols.
4. Use GitNexus `query` / `context` only when exact process, caller, or callee relationships are needed.
5. Run GitNexus `impact` before non-trivial edits to the selected symbol.

For existing diffs, PR review, or final handoff:

1. Start with Code Review Graph `get_minimal_context_tool`.
2. Use Code Review Graph `detect_changes_tool` with `detail_level="minimal"` and `include_source=false`.
3. Use GitNexus `impact` only for the highest-risk changed symbols.
4. Request MCP source snippets only when direct file reads are insufficient.

Avoid calling both MCPs for the same broad discovery question. Do not use GitNexus as the default broad codebase reader; use Code Review Graph first to conserve tokens, then use GitNexus surgically for precise symbol/process/caller impact.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence (MCP + CLI)

This repo is indexed by GitNexus. In Codex, use Code Review Graph first for broad, token-efficient codebase reading, then use the **GitNexus MCP server** for precise symbol/process discovery and required impact analysis. Use the **CLI** for repository/index operations such as `analyze`, `status`, `list`, `clean`, `serve`, and `wiki`.

## Preferred Workflow

- In Codex, use Code Review Graph first for broad codebase reading and diff triage; use GitNexus **MCP** for precise `query`, `context`, `impact`, `rename`, and `cypher` after the target is narrowed.
- Use GitNexus **CLI** when you need to refresh or inspect the index itself.
- If MCP is unavailable or appears stale/incomplete, fall back to CLI plus `rg` and direct code reads, and state that fallback explicitly.

## Why MCP Over CLI

- MCP lets Codex call GitNexus tools directly during the task instead of relying on manual terminal steps.
- MCP responses are structured for the agent, so impact/context analysis is easier to consume reliably than shell text parsing.
- MCP can serve all indexed repos from the global GitNexus registry without per-project reconfiguration.
- CLI remains the right tool for indexing and repo maintenance.

## MCP Tools Quick Reference

| Tool | When to use | What to expect |
|------|-------------|----------------|
| `query` | Start exploration from a concept or feature name | Process-grouped search results and related definitions |
| `context` | Understand one symbol deeply | Callers, callees, file location, and process participation |
| `impact` | Before editing any symbol | Blast radius with risk/depth grouping |
| `detect_changes` | Assess current diff impact | Changed lines mapped to affected processes |
| `rename` | Coordinate a symbol rename safely | Graph-aware rename guidance across files |
| `cypher` | Advanced graph inspection | Read-only custom graph queries |

## CLI Commands Quick Reference

| Command | When to use | Example |
|---------|-------------|---------|
| `analyze` | Index or refresh the current repo | `gitnexus analyze` |
| `status` | Check index freshness | `gitnexus status` |
| `list` | List indexed repos | `gitnexus list` |
| `clean` | Remove the current repo index | `gitnexus clean` |
| `serve` | Start local backend for web UI | `gitnexus serve` |
| `wiki` | Generate repo wiki from the graph | `gitnexus wiki` |

## Always Do

- **MUST run `impact` before editing any symbol.** Report blast radius, direct callers, processes, and risk level to the user.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding.
- When exploring unfamiliar code, start with `query`.
- When you need full symbol-level understanding, use `context`.
- When working from an existing diff, use `detect_changes` to understand affected flows.

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Keeping the Index Fresh

```bash
gitnexus status
gitnexus analyze
```

If the repo already has embeddings, preserve them on refreshes:

```bash
gitnexus analyze --embeddings
```

If the repo is already up to date and you are enabling embeddings for the first time, run `gitnexus analyze --force --embeddings`.

## Important Notes

- If multiple repos are indexed, pass the repo name explicitly in MCP/CLI when needed.
- GitNexus indexes TypeScript/JavaScript symbols well but **does not index SQL function names**; use grep for SQL RPC functions.
- `cypher` queries are **read-only**; do not use write operations.
- Check `.gitnexus/meta.json` after analyze. `stats.embeddings > 0` means embeddings are present.
- Running `gitnexus analyze` without `--embeddings` will drop existing embeddings.

<!-- gitnexus:end -->
