# Agent Instructions

## React Doctor: True Full Scan (Non-Diff)

React Doctor can auto-switch to diff-only scanning in non-interactive runs. When you need a true full-repo scan, force `diff: false` temporarily:

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

Do not rely on the default `react-doctor` script when you specifically need full-scan metrics.

## Verification Order For TypeScript / React Diffs

When a task changes `.ts` / `.tsx` files, run verification in this order before claiming success, committing, or opening/updating a PR:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused tests for the changed behavior
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

`verify:no-explicit-any` is diff-aware. It scans changed TypeScript files (committed branch diff, staged, unstaged, and untracked files) and fails on explicit `any` so REVIEW.md / CLAUDE.md type-safety violations are caught before review.

## Ralph Flow (Claude Code/Codex Execution)

When running Ralph workflow, follow this exact loop:

1. Read `prd.json` and `progress.txt` (read `## Codebase Patterns` first). If `progress.txt` does not exist, initialize it with:
   - `## Codebase Patterns`
   - `## Progress Log`
2. Ensure git branch matches `prd.json.branchName`; if not, checkout/create from `main`.
3. Pick the highest-priority story where `passes: false`.
4. Implement **only that one story**.
5. Run project quality checks.
   - For TypeScript / React diffs, run: `verify:no-explicit-any` → `typecheck` → focused tests → other checks as applicable.
   - Do not skip the explicit-`any` gate just because `typecheck` or `react-doctor` is green.
6. If checks pass:
   - Commit all related changes with: `feat: [Story ID] - [Story Title]`
   - Update `prd.json` to set that story `passes: true`
   - Append progress to `progress.txt` (never overwrite)
7. If you discover reusable patterns:
   - Add general patterns to top `## Codebase Patterns` in `progress.txt`
   - Update nearby `CLAUDE.md` files with durable, reusable guidance only
8. UI stories:
   - Verify in browser if tooling is available
   - If no browser tooling, record manual verification requirement/status
9. Stop after one story. If all stories are complete, return: `<promise>COMPLETE</promise>`.

### Progress Report Format (append only)

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

### Ralph PRD Constraints

- Keep each story small enough for one iteration/context window.
- Order stories by dependency (schema/backend before UI/aggregation).
- Every story must include `Typecheck passes` and `Tests pass`.
- UI stories should use `Manual browser verification completed` in this project.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed)
   - For `.ts` / `.tsx` changes: `node scripts/npm-run.js run verify:no-explicit-any` before `typecheck`, tests, and `react-doctor`
   - Then run the remaining tests/linters/builds required by the task
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

**FAST APPLY:** 
IMPORTANT: Use `edit_file` over `str_replace` or full file writes. It works with partial code snippets—no need for full file content.


**WARP GREP:** 
- warp-grep is a subagent that takes in a search string and tries to find relevant context. Best practice is to use it at the beginning of codebase explorations to fast track finding relevant files/lines. 
- Do not use it to pin point keywords, but use it for broader semantic queries. "Find the XYZ flow", "How does XYZ work", "Where is XYZ handled?", "Where is <error message> coming from?"

## Skill Enforcement

- For any task that generates or materially edits TypeScript/React code (`.ts`, `.tsx`, React components, hooks, client/server UI logic), you MUST invoke the `react-best-practices` skill first (or `vercel-react-best-practices` if that is the available skill name in the session).
- For any task that generates or materially edits Next.js code or framework behavior (App Router routes/layouts/pages, route handlers, metadata, error boundaries, middleware/proxy, RSC boundaries, async request APIs, image/font/script/bundling), you MUST invoke the `next-best-practices` skill first.
- For Next.js tasks that also involve substantial React component logic, invoke both skills in this order: `next-best-practices` then `react-best-practices` (or `vercel-react-best-practices`).
- For any task that creates or modifies SQL migration files/DDL for Supabase/Postgres, you MUST invoke the `supabase-best-practices` skill first (or `supabase-postgres-best-practices` if that is the available skill name in the session).
- If a required skill is unavailable in the current session, state that explicitly and proceed with the closest available fallback guidance.

## Basic Memory Session Convention

Basic Memory is the durable memory layer for this repo. It is not a complete or automatic transcript of every Codex/Claude chat.

- Treat Basic Memory as curated project memory, not raw chat history.
- Write a memory note when a session produces a durable decision, a non-obvious debugging finding, a workflow rule, a deploy/recovery step, or a repo-specific gotcha that should survive the current context window.
- Do not write a memory note for temporary brainstorming, duplicate status chatter, or information already captured clearly in code, tests, migrations, `progress.txt`, PRs, or existing docs.
- At session end, prefer one concise summary note instead of many fragmented notes.
- If a note contains assumptions, mark them explicitly as assumptions.
- If a previous memory might now be stale, create/update a note that says what changed and on what date instead of silently contradicting it.

### Memory Note Template

Use this structure when saving a session note to Basic Memory:

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

At the start of any non-trivial task, check whether relevant Basic Memory notes exist before re-deriving prior decisions. If memory and code disagree, trust the current code and update memory.


## ⚠️ Role Normalization (`admin` = `global`)

The RPC proxy (`/api/rpc/[fn]`) auto-normalizes `admin` → `global` before signing JWT. **Outside the proxy** (standalone API routes, Edge Functions, server utilities), the NextAuth session still contains the raw `admin` role.

**MANDATORY:** When checking for global/admin access outside the RPC proxy, ALWAYS use `isGlobalRole()` from `@/lib/rbac`. NEVER write `role === 'global'` — this silently excludes `admin` users from tenant-bypass logic.

```typescript
// ❌ BAD: misses admin users → silent data-empty failure
const filtered = role === 'global' ? allItems : items.filter(...)

// ✅ GOOD: isGlobalRole handles both global and admin
import { isGlobalRole } from '@/lib/rbac'
const filtered = isGlobalRole(role) ? allItems : items.filter(...)
```






**Key conventions:**
- Controllers handle HTTP requests/responses only
- Services contain business logic
- Models define data structure and DB operations
- All async operations use async/await (no callbacks)

### File Size Rules (MANDATORY)

- **350-line extraction threshold:** When a file approaches ~350 lines, proactively extract logical chunks (helpers, sub-components, types, constants) into separate files.
- **450-line hard ceiling:** No source file should exceed 450 lines. If it does, split it before adding more code.
- **What to extract:** utility functions → `{Module}Utils.ts`, types → `{Module}Types.ts`, sub-components → `{Module}{Part}.tsx`, constants → `{Module}Constants.ts`.
- **Naming:** Follow grep-friendly module prefix convention (`{ModuleName}{Chunk}.tsx`).

---


## SQL Code Generation Checklist
**Project ID**: cdthersvldpnlbvpufrr (Supabase MCP)
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

## 🔗 Combined Workflow: GitNexus + Basic Memory

These two MCP servers complement each other. Use them together for maximum effectiveness:

| MCP Server | Answers | Persistence |
|------------|---------|-------------|
| **GitNexus** | WHERE is the code, WHAT calls what, impact blast radius | Ephemeral (per-query, reflects current code) |
| **Basic Memory** | WHY a decision was made, historical findings, gotchas | Persistent (survives across sessions) |

### Standard Session Loop

```
1. START OF SESSION
   basic-memory: search("feature area")
   → Retrieve prior decisions, known gotchas, architectural constraints

2. DISCOVERY / IMPACT ANALYSIS
   gitnexus: query("symbol or feature")
   gitnexus: impact("target symbol")
   → Real-time code graph, blast radius, direct callers

3. IMPLEMENT
   Write code using both contexts combined

4. END OF SESSION
   basic-memory: write_note(...)
   → Save durable decisions, non-obvious findings, environment gotchas
   → Skip ephemeral brainstorming; trust code/tests for obvious facts
```

### Pattern: Investigate Before Changing

```
# Step 1 — Recall prior context (Basic Memory)
basic-memory search("repairRequest") → "Tách file vì vượt 350 lines (2026-04-01)"

# Step 2 — Find current impact (GitNexus)
gitnexus impact("RepairRequestSheet") → d=1: 3 callers, d=2: 8 indirect

# Step 3 — Implement with full context
# Step 4 — Save new findings back to Basic Memory
```

### When to Write a Memory Note

Write a note when you discover or decide something that a **future agent cannot easily re-derive from code alone**:
- ✅ Architectural trade-off (why X over Y)
- ✅ Non-obvious bug root cause
- ✅ Environment / deploy gotcha
- ✅ Workflow rule change
- ❌ Anything already obvious from code/tests/migrations/PRs

<!-- gitnexus:start -->
# GitNexus — Code Intelligence (MCP + CLI)

This repo is indexed by GitNexus. In Codex, prefer the **GitNexus MCP server** for day-to-day discovery and impact analysis. Use the **CLI** for repository/index operations such as `analyze`, `status`, `list`, `clean`, `serve`, and `wiki`.

## Preferred Workflow

- In Codex, use GitNexus **MCP** first for `query`, `context`, `impact`, `detect_changes`, `rename`, and `cypher`.
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
