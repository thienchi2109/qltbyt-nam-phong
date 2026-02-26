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

📖 **Full RBAC Documentation:** See [`docs/RBAC.md`](docs/RBAC.md) for complete permission matrices, role hierarchy diagrams, and implementation patterns.

</SECURITY_CRITICAL>

---

<!-- OPENSPEC:START -->
## OpenSpec

Open `@/openspec/AGENTS.md` for: planning/proposals/specs, breaking changes, architecture shifts, security/performance work.
<!-- OPENSPEC:END -->

<!-- BEADS-TRACKER:START -->
## Issue Tracking (Beads)

**On Windows, use the helper script for proper output capture:**

```bash
# Use helper script for ALL bd commands
node scripts/run-cmd.js bd ready                    # Find work
node scripts/run-cmd.js bd create --title="..." --type=task --priority=2
node scripts/run-cmd.js bd update <id> --status=in_progress
node scripts/run-cmd.js bd close <id>
node scripts/run-cmd.js bd sync                     # ALWAYS at session end
node scripts/run-cmd.js bd stats                    # Project statistics
node scripts/run-cmd.js bd list --status=in_progress
```
<!-- BEADS-TRACKER:END -->

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

On Windows, `npm`, `npx`, and `bd` commands don't return stdout properly. **Always use the helper scripts:**

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

# Beads commands
node scripts/run-cmd.js bd ready
node scripts/run-cmd.js bd stats
node scripts/run-cmd.js bd list --status=in_progress
```

**Helper scripts:**
- `scripts/run-cmd.js` - Universal helper for any CLI command
- `scripts/npm-run.js` - Specialized helper for npm/npx commands

**Why:** `.cmd` batch files and some `.exe` files don't return stdout in certain shell contexts (Claude Code's Bash tool). These helpers use Node's `child_process.execSync` to properly capture output.

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
When working on React/Next.js code, PROACTIVELY invoke `/react-best-practices` skill:
- **Before** writing new components, hooks, or pages
- **During** code reviews for performance issues
- **When** implementing data fetching (client or server-side)
- **When** optimizing bundle size or re-renders

The skill contains 45 rules across 8 priority categories from Vercel Engineering.
Reference `C:\Users\win\.claude\skills\react-best-practices\rules\` for specific patterns.
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

## Conventions

- **Imports:** `@/*` alias, order: React → 3rd-party → `@/components` → `@/lib`
- **Types:** Never `any`, explicit interfaces, DB types in `src/types/database.ts`
- **Files:** 350-450 lines max
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
git pull --rebase && bd sync && git push
```

**Work is NOT complete until `git push` succeeds.**

## Priority

1. Security 2. Data Integrity 3. Type Safety 4. Performance 5. Maintainability
