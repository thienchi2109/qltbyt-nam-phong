# CLAUDE.md

AI assistant guidance for this repository (medical equipment management system).

<!-- OPENSPEC:START -->
## OpenSpec Instructions

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning/proposals/specs/changes
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and requires authoritative spec before coding

<!-- OPENSPEC:END -->

<!-- BEADS-TRACKER:START -->
## Issue Tracking with Beads (MANDATORY)

<CRITICAL_AUTO_INVOKE>
**You MUST invoke the `beads-tracker` skill IMMEDIATELY after:**

1. **Creating/Updating Design Documents**
   - Files: `**/design/*.md`, `**/docs/design-*.md`, `**/*-design.md`
   - After writing implementation plans or architecture decisions

2. **OpenSpec Change Proposals**
   - Files in: `openspec/changes/**/*.md`, `openspec/proposals/**/*.md`
   - After creating or modifying spec proposals

3. **Implementation Plans**
   - Files: `**/PLAN.md`, `**/plan.md`, `**/*-plan.md`
   - After `superpowers:brainstorm` or `superpowers:write-plan` outputs

4. **User Requests Issue Tracking**
   - "Create an issue...", "Track this...", "Add to backlog..."
   - "What should I work on?", "Show triage...", "Next task?"
</CRITICAL_AUTO_INVOKE>

### Quick Commands

```bash
# Finding Work
bd ready                    # Unblocked work ready to start
bd show <id>                # Issue details

# Creating Issues (after design docs)
bd create --title="..." --type=task --priority=2
# Priority: 0=critical, 1=high, 2=medium, 3=low, 4=backlog

# AI Triage (use bv for analysis)
bv --robot-triage           # Full project triage JSON
bv --robot-next             # Single top recommendation
bv --robot-plan             # Execution plan with dependencies

# Lifecycle
bd update <id> --status=in_progress
bd close <id>
bd sync                     # ALWAYS sync at session end!
```

### Post-Document Workflow

After creating any design/plan/spec document:
1. **Extract tasks** from the document
2. **Create issues** with `bd create`
3. **Link dependencies** with `bd dep add`
4. **Get execution plan** with `bv --robot-plan`
5. **Sync changes** with `bd sync`

**Skill location**: `~/.claude/skills/beads-tracker/SKILL.md`
<!-- BEADS-TRACKER:END -->

<!-- CONTEXT-ENGINEERING:START -->
## Context Engineering (MANDATORY)

<CRITICAL_AUTO_INVOKE>
**You MUST invoke the `context-engineering` skill when:**

1. **Agent/Multi-Agent Systems**
   - Designing agent architectures or workflows
   - Debugging agent failures or context degradation
   - Implementing multi-agent coordination patterns
   - Building LLM-powered pipelines or batch processing

2. **Context Optimization**
   - Approaching 70-80% token utilization (warning threshold)
   - Performance degradation in long conversations
   - Need to optimize cost/latency for LLM operations
   - Implementing context compaction or caching strategies

3. **Memory Systems**
   - Building cross-session persistence
   - Implementing knowledge graphs or retrieval systems
   - Designing context selection/filtering mechanisms

4. **Tool Design**
   - Creating new MCP tools or skills
   - Optimizing tool descriptions for better LLM understanding
   - Consolidating multiple tools into unified interfaces

5. **Evaluation & Testing**
   - Testing agent performance
   - Implementing LLM-as-Judge evaluation
   - Measuring context quality metrics

6. **Subagent-Driven Development**
   - Using subagent-driven-development skill with >5 tasks
   - Token utilization >70% during multi-agent workflows
   - Review loops exceeding 2 iterations (context degradation)
   - Need to optimize prompt templates for subagent dispatch
   - Subagents asking excessive clarifying questions (poor context curation)
</CRITICAL_AUTO_INVOKE>

### Core Principles

- **Context quality > quantity** - High-signal tokens beat exhaustive content
- **Attention is finite** - U-shaped curve favors beginning/end positions
- **Progressive disclosure** - Load information just-in-time
- **Isolation prevents degradation** - Partition work across sub-agents
- **Measure before optimizing** - Know your baseline

### Quick Reference

| Metric | Threshold | Action |
|--------|-----------|--------|
| Token utilization | 70% | Warning - consider optimization |
| Token utilization | 80% | Trigger compaction/compression |
| Compaction target | 50-70% | Reduction with <5% quality loss |
| Cache hit rate | 70%+ | For stable workloads |
| Multi-agent cost | ~15x | Single agent baseline |

### Four-Bucket Strategy

1. **Write**: Save context externally (files, scratchpads)
2. **Select**: Pull only relevant context (retrieval, filtering)
3. **Compress**: Reduce tokens while preserving info (summarization)
4. **Isolate**: Split across sub-agents (partitioning)

**Skill location**: `~/.claude/plugins/marketplaces/claudekit-skills/.claude/skills/context-engineering/SKILL.md`
<!-- CONTEXT-ENGINEERING:END -->

## Superpowers System

<EXTREMELY_IMPORTANT>
Before any other command, run:
- WSL: `node ~/.codex/superpowers/.codex/superpowers-codex bootstrap`
- Git Bash/PowerShell/CMD: `~/.codex/superpowers/.codex/superpowers-codex bootstrap`
</EXTREMELY_IMPORTANT>

# 🚨 CRITICAL INSTRUCTIONS - READ FIRST

## MANDATORY Tool Usage

You MUST use these Morph MCP tools for ALL code operations:

### 1. Code Search: ALWAYS use `warpgrep_codebase_search`
- Tool: `mcp__filesystem-with-morph__warpgrep_codebase_search`
- For: Finding code, exploring codebase, understanding flows
- **NEVER** use: grep, search_files, ripgrep, or any other search tool
- **ALWAYS** announce: "I'll use warpgrep to search..."

**Examples:**
```
✅ CORRECT: "I'll use warpgrep to find authentication logic"
❌ WRONG: "I'll use grep to search for auth"
```

### 2. File Editing: ALWAYS use `edit_file`
- Tool: `mcp__filesystem-with-morph__edit_file`
- For: ALL file modifications
- **NEVER** use: write_file, str_replace, or full file rewrites
- **ALWAYS** announce: "I'll use edit_file to modify..."
- Use lazy edits with `// ... existing code ...` markers

**Examples:**
```
✅ CORRECT: "I'll use edit_file to add error handling"
❌ WRONG: "I'll rewrite the entire file"
```

## Verification Before Every Action

Before ANY code search or edit, you MUST:
1. ✅ Check if warpgrep/edit_file is available
2. ✅ Explicitly state which tool you're using
3. ✅ Use the tool (not alternatives)
4. ✅ If tools unavailable, inform user immediately

---
NOTE: Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

### GitLab Knowledge Graph (GKG)

This project is indexed with **GitLab Knowledge Graph MCP**. You have access to the following tools:

#### When to Use GKG:

**✅ ALWAYS use GKG for:**
- Finding where functions/classes are defined
- Understanding code structure and relationships
- Discovering what calls/uses a specific function
- Mapping dependencies between modules
- Finding all implementations of an interface/class
- Impact analysis ("what breaks if I change X?")
- Locating test files for specific code

**❌ DON'T use GKG for:**
- Understanding business logic flow (use code reading instead)
- Finding configuration values (just read config files)
- Simple grep tasks (e.g., "find string 'TODO'")
- When user explicitly asks to read specific files

#### Available GKG Tools:

1. **`list_projects`**
   - Lists all indexed projects in knowledge graph
   - Use when: User asks "what projects do you have access to?"

2. **`search_codebase_definitions`**
   - Search for functions, classes, methods, types, interfaces
   - Parameters: `query` (string), `project_name` (optional)
   - Example: Find all controller classes, locate UserService, find calculatePrice function
   - **Use this FIRST** when user asks about specific code elements

3. **`get_references`**
   - Find all places where a definition is used/called
   - Parameters: `uri` (from search results), `project_name`
   - Example: "What calls this function?", "Where is this class used?"
   - **Critical for impact analysis**

4. **`get_definition`**
   - Get full details of a specific definition
   - Parameters: `uri` (from search results), `project_name`
   - Returns: Code location, signature, documentation
   - Use when: Need exact implementation details

5. **`reindex_project`**
   - Refresh knowledge graph after code changes
   - Only use if: User reports stale/missing results
   - Note: Requires GKG server restart

## Session Completion Workflow

**MANDATORY when ending work session:**
1. File issues for remaining work
2. Run quality gates (tests, linters, builds) if code changed
3. Update issue status
4. **PUSH TO REMOTE** (MANDATORY):
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. Clean up (stashes, prune branches)
6. Verify all changes committed AND pushed
7. Hand off context for next session

**CRITICAL**: Work is NOT complete until `git push` succeeds. NEVER stop before pushing. YOU must push, not the user.

## Project Overview

Vietnamese Medical Equipment Management System - Multi-tenant healthcare app. Next.js 15, React 18, TypeScript, Supabase (PostgreSQL), NextAuth v4.

**Critical**: Security-sensitive with strict multi-tenant isolation.

### Technology Stack

**Core**: Next.js 15.3.3 (App Router, Turbopack) • React 18.3.1 • TypeScript 5.x (strict) • Tailwind CSS 3.x • Radix UI (42 components) • shadcn/ui

**State**: TanStack Query v5 (server state) • NextAuth v4 (auth/sessions) • React Context (language, branding, realtime)

**Backend**: Supabase (PostgreSQL + PostgREST, 154 migrations) • Custom RPC Gateway (tenant isolation)

**Key Libraries**: react-hook-form + zod • Recharts • react-window • lucide-react • date-fns • qrcode.react • html5-qrcode • xlsx • next-pwa • workbox • firebase (FCM, Drive)

**Deploy**: Vercel (primary) • Cloudflare Pages (edge)

## Commands

```bash
# Dev
npm run dev              # Dev server (port 3000, Turbopack)
npm run dev-https        # HTTPS dev (port 9002)
npm run typecheck        # TypeScript check (REQUIRED before commits)

# Build
npm run build            # Standard build
npm run build:vercel     # Vercel build
npm run build:cloudflare # Cloudflare build

# Deploy
npm start                # Production server
npm run deploy:dual      # Deploy to Vercel + Cloudflare

# Quality
npm run lint             # ESLint (no Prettier)
```

**Notes**: 
- `npm run typecheck` mandatory before commits
- Use `npm` only (NOT pnpm/yarn)
- No test runner configured (sample tests in `src/lib/__tests__/`)

## Key Features

**Equipment**: CRUD • QR generation/scanning • Lifecycle tracking • Attachments • Bulk import • Advanced filtering (tenant/dept/category/status)

**Maintenance**: Preventive scheduling • Task management • Calendar view • Frequency-based planning • Completion tracking • History/reports

**Repairs**: Request creation/tracking • Multi-level approval • Status tracking • Technician assignment • History/analytics • Frequency insights

**Transfers**: Internal (dept-to-dept) + External (tenant-to-tenant) • Approval workflows • Kanban board • Audit trail

**Users**: RBAC (5 roles: global, regional_leader, to_qltb, technician, user) • Multi-tenant assignments • Department restrictions

**Reports**: Status distribution • Maintenance stats • Usage analytics • Inventory • Dept performance • Custom date ranges

**Audit**: Activity logs (global only) • Equipment history • User action tracking

**Multi-Tenant**: Strict isolation • Tenant-aware queries • Tenant switching (global/regional) • Per-tenant branding • Regional leader access (multi-tenant within region)

**PWA**: Offline caching • Mobile-first responsive • QR scanner • Firebase Cloud Messaging (repair/transfer/maintenance notifications)

## Architecture

### Multi-Tenant Security Model

**RPC-Only Architecture**: All DB access via `/api/rpc/[fn]` proxy. Direct table access PROHIBITED.

**Isolation Flow**:
1. NextAuth auth → `authenticate_user_dual_mode` RPC
2. JWT includes: `role`, `don_vi` (tenant), `dia_ban_id` (region), `user_id`
3. Proxy validates session, signs JWT with `SUPABASE_JWT_SECRET`
4. **Non-global users**: Proxy forcibly overrides `p_don_vi` to user's tenant
5. RPC functions enforce boundaries via JWT claims

**Roles**: `global` (all tenants) • `regional_leader` (multi-tenant in region) • `to_qltb` (equipment team) • `technician` (dept-restricted) • `user` (basic)

### Authentication

**NextAuth v4** (NOT custom auth)
- Config: `src/auth/config.ts` (JWT, 3hr sessions)
- Routes: `src/middleware.ts` protects `/(app)/*`
- Session: JWT includes `{id, username, role, khoa_phong, don_vi, dia_ban_id, full_name}`
- Auto-refresh validates `password_changed_at`
- Access: `useSession()` from `next-auth/react`

### RPC Gateway (`/api/rpc/[fn]`)

**Critical Security**: `src/app/api/rpc/[fn]/route.ts`

**Client**: `callRpc({ fn: 'function_name', args: {...} })` from `@/lib/rpc-client.ts`

**Flow**:
1. Whitelist check (`ALLOWED_FUNCTIONS`)
2. Session validation (`getServerSession`)
3. Role normalization (`admin` → `global`)
4. **Tenant isolation**: Overwrites `p_don_vi` for non-global/non-regional
5. Signs JWT: `{role: 'authenticated', app_role, don_vi, user_id, dia_ban}`
6. Proxies to Supabase PostgREST `/rest/v1/rpc/{fn}`

**Adding RPC Functions**:
1. Add to `ALLOWED_FUNCTIONS`
2. Include role/tenant checks: `current_setting('request.jwt.claims')`
3. Grant: `GRANT EXECUTE ON FUNCTION fn TO authenticated;`
4. **Always prefer RPC over direct table access**

**100+ Functions**: Equipment, Repairs, Transfers, Maintenance, Tenants/Users, Reports, Usage Logs, Auth

### File Structure

```
src/                        # 222 TypeScript files
├── app/(app)/              # Protected routes
│   ├── activity-logs/, dashboard/, equipment/, forms/, maintenance/
│   ├── qr-scanner/, repair-requests/, reports/, tenants/, transfers/, users/
│   └── layout.tsx
├── app/api/
│   ├── auth/[...nextauth]/ # NextAuth endpoints
│   ├── rpc/[fn]/           # **CRITICAL** RPC gateway (100+ functions)
│   └── tenants/, transfers/
├── auth/config.ts          # NextAuth JWT config
├── components/             # 117+ components (activity-logs, admin, dashboard, equipment, ui/42 Radix)
├── contexts/               # language, realtime, tenant-branding
├── hooks/                  # 25 hooks (cached, dashboard, realtime, repair/transfer alerts)
├── lib/                    # **rpc-client.ts**, supabase.ts, excel-utils, firebase, etc.
├── providers/              # query-provider, session-provider
├── types/                  # database, next-auth, next-pwa
└── middleware.ts           # Route protection

supabase/
├── functions/              # Edge functions (FCM, push notifications)
└── migrations/             # 154 SQL migrations (timestamped)

scripts/                    # build-cloudflare.js, deploy-dual.js, setup-cicd.js
docs/                       # 111+ docs (Deployment, Issues, security, session-notes)
openspec/                   # 60+ files (specs, changes)
public/                     # PWA assets (icons, manifest, sw, workbox)
```

### Component Architecture Pattern (RepairRequests Reference)

The RepairRequests module demonstrates the preferred architecture for complex page modules with multiple dialogs and state management.

**Pattern: Context + Extracted Components**

```
repair-requests/
├── _components/
│   ├── RepairRequestsContext.tsx      # Context provider (state, mutations, dialog actions)
│   ├── RepairRequestsPageClient.tsx   # Smart container (data fetching, orchestration)
│   ├── RepairRequestsTable.tsx        # Presentational (table rendering)
│   ├── RepairRequestsToolbar.tsx      # Presentational (search, filters, display settings)
│   ├── RepairRequestsEditDialog.tsx   # Self-contained dialog (consumes context)
│   ├── RepairRequestsDeleteDialog.tsx # Self-contained dialog
│   ├── RepairRequestsApproveDialog.tsx
│   ├── RepairRequestsCompleteDialog.tsx
│   ├── RepairRequestsCreateSheet.tsx
│   └── RepairRequests*.tsx            # Other components with prefix
├── _hooks/
│   └── useRepairRequestsContext.ts    # Custom hook with error checking
└── types.ts                           # Shared types (AuthUser, etc.)
```

**Key Principles:**
- **Context for shared state**: Dialog open/close, selected items, user permissions
- **Local state for forms**: Each dialog manages its own form state
- **TanStack Query mutations**: Centralized in context, consumed via hooks
- **Memoization**: Context value wrapped in `useMemo`, actions in `useCallback`
- **Prop elimination**: Dialogs get everything from context (0 props)
- **File naming**: All components prefixed with module name for grep-ability

**Context Structure:**
```typescript
interface RepairRequestsContextValue {
  // User/permissions
  user: AuthUser | null
  canSetRepairUnit: boolean
  isRegionalLeader: boolean

  // Dialog state
  dialogState: DialogState
  openEditDialog: (request: RepairRequest) => void
  closeAllDialogs: () => void

  // Mutations (from TanStack Query)
  createMutation: UseMutationResult<...>
  updateMutation: UseMutationResult<...>
  // ... other mutations
}
```

**Benefits achieved:**
- Prop drilling: ~60 props → ~5 props
- Main file: 1207 lines → 837 lines
- Dialog components: 15-22 props → 0 props
- Clear separation: Smart container vs presentational components

### Database Schema

**Core**: `nhan_vien` (users) • `don_vi` (tenants) • `dia_ban` (regions) • `thiet_bi` (equipment) • `khoa_phong` (departments) • `loai_thiet_bi` (categories) • `nha_cung_cap` (suppliers)

**Workflows**: `yeu_cau_sua_chua` (repairs) • `ke_hoach_bao_tri` (maintenance plans) • `nhiem_vu_bao_tri` (tasks) • `yeu_cau_luan_chuyen` (transfers) • `lich_su_thiet_bi` (equipment history) • `lich_su_hoat_dong` (activity logs)

**Lookups**: `trang_thai_sua_chua`, `muc_do_uu_tien`, `tan_suat_bao_tri` + enumeration tables

**No RLS**: Security via RPC functions with role/tenant checks.

**154 Migrations** (2024-12 to 2025-11): Initial schema → Multi-tenant → Regional leader → Maintenance → Analytics → Performance

### Data Fetching

**TanStack Query v5 ONLY** - NEVER use useState for server data.

```typescript
import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

const { data, isLoading, error } = useQuery({
  queryKey: ['equipment', { don_vi: currentTenant }],
  queryFn: () => callRpc({ fn: 'equipment_list', args: { p_don_vi: currentTenant } }),
  enabled: !!currentTenant
})
```

**Notes**: Equipment list doesn't fetch until tenant selected (global users) • `callRpc` wraps `/api/rpc/[fn]`

### Conventions

**Imports**: Always `@/*` alias. Order: React/Next → 3rd-party → `@/components` → `@/lib` → `@/types`. No relative imports beyond `./`

**TypeScript**: NEVER `any` • Explicit types for public interfaces • Return types required • DB types in `src/types/database.ts`

**UI**: Radix UI + Tailwind (no inline styles unless dynamic) • Mobile-first • react-hook-form + zod • stopPropagation on row actions

## Database Operations

### Migration Workflow

**Run SQL in Supabase SQL Editor** (no CLI). Keep idempotent.

1. Analyze schema (MCP Supabase tools)
2. Create: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
3. Format: Transaction wrapper, rollback, comments
4. Idempotent: `CREATE OR REPLACE`, `IF NOT EXISTS`
5. Grant: `GRANT EXECUTE ON FUNCTION fn TO authenticated;`
6. Whitelist: Add to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
7. Commit to `supabase/migrations/`
8. Apply manually in SQL Editor (NEVER auto-execute)

### RPC Function Template

```sql
CREATE OR REPLACE FUNCTION function_name(
  p_param1 TYPE,
  p_don_vi TEXT DEFAULT NULL
)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Hardening
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi TEXT;
BEGIN
  -- Extract JWT claims
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';

  -- Validate permissions
  IF v_user_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Enforce tenant isolation for non-global users
  IF v_user_role != 'global' AND v_user_role != 'regional_leader' THEN
    p_don_vi := v_user_don_vi; -- Override client-supplied parameter
  END IF;

  -- Business logic here
  RETURN ...;
END;
$$;

GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```
## File Structure Expectations

- Files: 350-450 lines maximum, single responsibility
- Filenames: Descriptive, match content exactly
- Headers: First 5-15 lines explain purpose (multi-item files only)

## Code Quality Standards

- Self-documenting: names explain intent
- Clear variables: `userAuthenticatedAt` not `uat`
- Action-based functions: `calculateTaxForOrder()` not `calcTax()`
- Semantic directories: group by feature/domain, max 3-4 levels

## Working Approach

- Navigate first: Understand structure before reading code
- Read purposefully: Only open relevant files
- Trust the structure: Filename and location tell you what's inside
- Small focused changes: Maintain 350-450 line limit
- Keep it clean: Don't break existing conventions

## Quality Check

Before completing tasks:
1. Files under 450 lines
2. Filenames accurately describe content
3. Code is self-documenting
4. Directory structure stays logical
5. Changes follow existing patterns

## Token Optimization

- Don't read entire files unnecessarily
- Use grep to find specific patterns
- Check file headers before reading full content
- Navigate using directory structure, not memory


## Security Rules

**NEVER**: Direct DB access • Trust client `p_don_vi` • Use `any` • Modify `src/auth/config.ts` without instruction • Store secrets client-side • Bypass tenant checks • `@ts-ignore` • Commit `console.log`

**Multi-Tenancy**: Filter by `current_don_vi` • Validate tenant access • Check `session.don_vi` • Override `p_don_vi` in proxy

**Errors**: Parse `error.details` as JSON • Return `NextResponse.json({error, details?})` • Log with context • Fail fast

## Deployment

**Vercel** (primary, Node.js routes) • **Cloudflare Pages** (edge, static export)

Node.js APIs: `export const runtime = 'nodejs'`

**Env** (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_MIDDLEWARE_ENABLED=true`

## Testing

Jest-style tests in `src/lib/__tests__/`, `src/app/(app)/transfers/__tests__/` (no runner configured). Test: multi-tenant isolation • error scenarios • RPC auth • tenant filtering. **Always `npm run typecheck` before commits.**

## Performance

TanStack Query with cache keys • Memoize expensive computations • Loading states • Defer image loading • Cache tenants/lookups

**Equipment Page (Global)**: No fetch until tenant selected (reduce DB load). Tip shown. Last selection in `localStorage:equipment_tenant_filter`

## Vietnamese Support

Primary UI: Vietnamese • Medical terminology • Vietnam timezone (Asia/Ho_Chi_Minh)

## Priority Hierarchy

1. Security (auth, isolation) 2. Data Integrity 3. Type Safety 4. Performance 5. Maintainability 6. Features


**Dev Setup**: npm (NOT pnpm/yarn) • Node 18.17+ • Supabase cloud (no CLI) • Ports: 3000 (HTTP), 9002 (HTTPS)

**Scripts**: build-cloudflare.js • deploy-dual.js • setup-cicd.js
**CI/CD**: `.github/workflows/` (deploy-dual.yml, preview-deploy.yml)
