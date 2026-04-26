# Agent Instructions

## Context-Mode Routing (MANDATORY)

The `context-mode` MCP server is configured globally for this repo. Its tools (`ctx_execute`, `ctx_batch_execute`, `ctx_execute_file`, `ctx_index`, `ctx_search`, `ctx_fetch_and_index`) protect the agent context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session — these rules are NOT optional.

### Think in Code

When you need to analyze, count, filter, compare, search, parse, transform, or process data: **write code** that does the work via `ctx_execute(language, code)` and `console.log()` only the answer. Do NOT read raw data into context to process mentally. Program the analysis, don't compute it in reasoning. Use Node.js built-ins only (`fs`, `path`, `child_process`), `try/catch`, null-safe.

### BLOCKED in Bash — never retry

- `curl` / `wget` → use `ctx_fetch_and_index(url, source)` or `ctx_execute("javascript", "const r = await fetch(...)")`.
- Inline HTTP calls (`fetch('http`, `requests.get(`, `http.get(`, `http.request(`) → run inside `ctx_execute`.
- WebFetch is denied entirely → use `ctx_fetch_and_index` then `ctx_search`.

### Bash redirected when output >20 lines

Bash is ONLY for short-output ops: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`. For everything else (test runners, `gh`, `git log`/`git diff`, build output, large grep, `react-doctor`, `vitest run`):

- `ctx_batch_execute(commands, queries)` — primary tool. ONE call replaces 30+. Each command: `{label: "descriptive header", command: "..."}`. Labels become FTS5 chunk titles.
- `ctx_execute(language: "shell", code: "...", intent: "what you want from the output")` — single command, sandbox, only stdout enters context.

For the `verify:no-explicit-any` → `typecheck` → focused vitest → `react-doctor` chain, gather them all in **one** `ctx_batch_execute` so failures are searchable via `ctx_search`.

### Read / Grep redirected for analysis

- Reading a file to **edit** it → `read` is correct (Edit needs content in context).
- Reading to **analyze, explore, summarize** → `ctx_execute_file(path, language, code)`. Only your printed summary enters context.
- Large grep results → `ctx_execute(language: "shell", code: "rg ...")` and print only counts/snippets.

### Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute` — runs all commands, auto-indexes output, returns search results.
2. **FOLLOW-UP**: `ctx_search(queries: [...])` — query indexed content. Pass ALL questions in one call.
3. **PROCESSING**: `ctx_execute` / `ctx_execute_file` — sandbox execution.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search`.
5. **INDEX**: `ctx_index(content, source)` — store content for later search.

### Output constraints

- Keep responses concise. Write artifacts (code, configs, PRDs) to FILES, not inline. Return only: file path + 1-line description.
- Use descriptive `source` labels when indexing so future `ctx_search(source: "...")` works.

### ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call `ctx_stats` and display verbatim. |
| `ctx doctor` | Call `ctx_doctor`, run returned shell command, display as checklist. |
| `ctx upgrade` | Call `ctx_upgrade`, run returned shell command, display as checklist. |
| `ctx purge` | Call `ctx_purge` with `confirm: true`. Warn before wiping the knowledge base. |

After `/clear` or `/compact`: knowledge base and session stats are preserved. Use `ctx purge` to start fresh.

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

- The global skill `karpathy-coding-heuristics` is available in this environment. For non-trivial coding, refactoring, and code review tasks, explicitly consider invoking it to preserve Andrej Karpathy's core heuristics: surface meaningful assumptions, prefer the simplest sufficient design, keep diffs surgical, and define concrete verification before claiming success.
- Treat `karpathy-coding-heuristics` as a heuristic overlay, not a replacement for stricter required workflows. User instructions, repo instructions, and mandatory skills/checks still take precedence.
- For any task that generates or materially edits TypeScript/React code (`.ts`, `.tsx`, React components, hooks, client/server UI logic), you MUST invoke the `react-best-practices` skill first (or `vercel-react-best-practices` if that is the available skill name in the session).
- For any task that generates or materially edits Next.js code or framework behavior (App Router routes/layouts/pages, route handlers, metadata, error boundaries, middleware/proxy, RSC boundaries, async request APIs, image/font/script/bundling), you MUST invoke the `next-best-practices` skill first.
- For Next.js tasks that also involve substantial React component logic, invoke both skills in this order: `next-best-practices` then `react-best-practices` (or `vercel-react-best-practices`).
- For any task that creates or modifies SQL migration files/DDL for Supabase/Postgres, you MUST invoke the `supabase-best-practices` skill first (or `supabase-postgres-best-practices` if that is the available skill name in the session).
- If a required skill is unavailable in the current session, state that explicitly and proceed with the closest available fallback guidance.

## Memori MCP Session Convention

Memori MCP is the durable memory layer for this repo. It is not a complete or automatic transcript of every Codex/Claude chat.

- Treat Memori MCP as curated project memory, not raw chat history.
- Write a memory note when a session produces a durable decision, a non-obvious debugging finding, a workflow rule, a deploy/recovery step, or a repo-specific gotcha that should survive the current context window.
- Do not write a memory note for temporary brainstorming, duplicate status chatter, or information already captured clearly in code, tests, migrations, `progress.txt`, PRs, or existing docs.
- At session end, prefer one concise summary via Memori MCP instead of many fragmented notes.
- If a note contains assumptions, mark them explicitly as assumptions.
- If a previous memory might now be stale, create/update a note that says what changed and on what date instead of silently contradicting it.

### Memory Note Template

Use this structure when saving durable session context to Memori MCP:

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

At the start of any non-trivial task, use Memori MCP `recall` to check for relevant notes before re-deriving prior decisions. If memory and code disagree, trust the current code and update memory.


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
v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');
IF v_role IS NULL OR v_role = '' THEN
  RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
END IF;
IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
END IF;
```

**Do not cargo-cult a direct `v_don_vi` guard into every tenant RPC.**

- For single-tenant roles (`to_qltb`, `qltb_khoa`, `technician`, `user`), an outer `IF NOT v_is_global AND v_don_vi IS NULL THEN ...` guard is correct and should remain explicit.
- For multi-tenant read roles like `regional_leader`, `don_vi` may be legitimately NULL because scope is derived from `dia_ban`. In those cases:
  - validate `v_role` and normalize empty-string `v_user_id` claims with `NULLIF(..., '')` before the `IS NULL` guard
  - normalize `admin -> global` if needed
  - call the approved helper (`allowed_don_vi_for_session()`) to enforce role-specific scope
  - document this choice in the migration so reviewers do not "fix" it back to a broken direct `don_vi` guard

When in doubt, compare against the nearest existing detail/list RPC for the same module and preserve the same access contract instead of applying a generic three-guard pattern.

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
