# Code Review Guidelines

Repo-specific review checklist for the Vietnamese Medical Equipment Management System.

---

## Priority Order

1. **Security** — tenant isolation, JWT claims, RPC-only access
2. **Data Integrity** — TOCTOU guards, audit trail, NULL handling
3. **Type Safety** — no `any`, explicit interfaces
4. **Performance** — TanStack Query patterns, memoization
5. **Maintainability** — naming, file size, component architecture

---

## Security (CRITICAL)

### RPC-Only Architecture

All database access MUST go through the RPC proxy:

```
Client → callRpc() → /api/rpc/[fn] → Supabase PostgREST → RPC Function
```

**Reject any PR that introduces:**

| Violation | Detection |
|-----------|-----------|
| `supabase.from('table')` | Direct table access bypasses tenant isolation |
| `supabase.rpc('fn')` | Bypasses JWT signing and tenant override |
| Fetch to Supabase URL directly | Bypasses session validation |

The only acceptable direct Supabase client usage is `.channel()` for Realtime subscriptions.

### New RPC Functions

Every new RPC function requires:

1. Add to `ALLOWED_FUNCTIONS` set in `src/app/api/rpc/[fn]/route.ts`
2. SQL function uses `SECURITY DEFINER SET search_path TO 'public', 'pg_temp'`
3. `GRANT EXECUTE ON FUNCTION ... TO authenticated`
4. `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC`
5. JWT claim extraction and NULL guards (see SQL Migrations below)
6. Tenant isolation enforcement — non-global users MUST be restricted by `v_don_vi`

### JWT Claim Guards

Every RPC function that writes data or returns tenant-scoped data must include:

```sql
-- All three guards are mandatory:
IF v_role IS NULL OR v_role = '' THEN
  RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
END IF;

IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
END IF;

IF NOT v_is_global AND v_don_vi IS NULL THEN
  RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
END IF;
```

Without these, a malformed JWT silently produces NULL values that bypass tenant checks and defeat audit trails.

### Role Enforcement

| Role | Access | Reviewer Must Verify |
|------|--------|---------------------|
| `global` / `admin` | All tenants | Can see cross-tenant data |
| `regional_leader` | Multi-tenant | **Read-only** — reject any write path |
| `to_qltb` | Single tenant | Full CRUD within tenant |
| `technician` | Tenant + department | Department filter applied |
| `qltb_khoa` | Tenant + department | Department filter applied |
| `user` | Single tenant | Read-only within tenant |

Frontend role checks (`src/lib/rbac.ts`) are for UI only. Always verify the corresponding RPC function enforces the same permission server-side.

---

## SQL Migrations

### Structure Checklist

- [ ] Wrapped in `BEGIN; ... COMMIT;`
- [ ] Header comment explaining what the migration fixes and why
- [ ] Named with timestamp prefix: `YYYYMMDDHHMMSS_description_snake_case.sql`
- [ ] No duplicate/no-op migrations (check for identical `CREATE OR REPLACE` already applied)

### Function Security Checklist

- [ ] `SECURITY DEFINER SET search_path TO 'public', 'pg_temp'`
- [ ] `GRANT EXECUTE ... TO authenticated` + `REVOKE ... FROM PUBLIC`
- [ ] NULL guards for `v_role`, `v_user_id`, `v_don_vi` (see JWT Claim Guards above)
- [ ] `regional_leader` blocked from write operations
- [ ] `FOR UPDATE` lock on rows that will be modified (prevents TOCTOU races)
- [ ] Never uses `to_jsonb(entire_row)` on tables with sensitive columns (`nhan_vien` has passwords)
- [ ] Empty strings handled: `nullif(value, '')` before use in CASE/WHERE branches
- [ ] Tenant check does NOT short-circuit on `v_don_vi IS NOT NULL` — guard NULL earlier instead

### Common Bugs to Watch For

**TOCTOU race:** A `SELECT` validates a row, then a separate `UPDATE` modifies it. Between the two, another transaction can change the row. Fix: use `FOR UPDATE` on the validating `SELECT`.

**Empty-string CASE corruption:** `p_data ? 'field'` is true when `{"field": ""}` is sent. If the CASE branches assume a meaningful value, they corrupt dependent fields. Guard: `p_data ? 'field' AND nullif(p_data->>'field', '') IS NOT NULL`.

**NULL tenant bypass:** `NOT v_is_global AND v_don_vi IS NOT NULL AND ...` silently skips the check when `v_don_vi` is NULL. Fix: fail early if non-global user has NULL `v_don_vi`.

---

## TypeScript & React

### Types

- **Never use `any`** — use `unknown` + type guards, or proper generics
- Database types live in `src/types/database.ts` — import from there
- Define explicit interfaces for component props, API responses, form schemas

### Data Fetching

**Required pattern:** TanStack Query v5 + `callRpc()`

```typescript
const { data } = useQuery({
  queryKey: ['items', { don_vi }],
  queryFn: () => callRpc({ fn: 'item_list', args: { p_don_vi: don_vi } }),
  enabled: !!don_vi,
})
```

**Reject:** `useState` for server data, `useEffect` + fetch patterns, direct Supabase client queries.

### Component Architecture

New modules should follow the RepairRequests pattern:

```
module/
├── _components/
│   ├── ModuleContext.tsx           # State, mutations, dialog actions
│   ├── ModulePageClient.tsx        # Smart container
│   ├── ModuleTable.tsx             # Presentational
│   └── Module*Dialog.tsx           # Self-contained, 0 props — reads from context
├── _hooks/
│   └── useModuleContext.ts         # Context consumer hook
└── types.ts
```

**Review points:**
- [ ] Context value wrapped in `useMemo`
- [ ] Actions wrapped in `useCallback`
- [ ] Dialog components use context (not prop drilling)
- [ ] Mutations go through context, not directly in UI components

### File Naming

All files MUST use the module prefix for grep-discoverability:

```
RepairRequestsTable.tsx       ← CORRECT
Table.tsx                     ← REJECT (ambiguous across modules)
```

Pattern: `{ModuleName}{ComponentType}.tsx`

### File Size

| Threshold | Action |
|-----------|--------|
| < 450 lines | Ideal |
| 450–800 lines | Flag for refactoring discussion |
| > 800 lines | Reject — must be split |

### Imports

Order: React → third-party → `@/components` → `@/lib` → relative

Always use the `@/*` path alias. No `../../..` deep relative imports.

### Immutability

Always create new objects via spread. Never mutate:

```typescript
// REJECT
user.name = newName

// ACCEPT
const updated = { ...user, name: newName }
```

---

## General Quality

### Prohibited in Production Code

- `console.log` — use `console.error` or `console.warn` for legitimate logging
- `any` type annotations
- Hardcoded secrets, API keys, or credentials
- `// @ts-ignore` or `// @ts-expect-error` without a justifying comment

### Error Handling

- Handle errors explicitly at every level
- User-facing errors must be in Vietnamese (consistent with existing UI)
- Server-side errors must log detailed context
- Never silently swallow errors (empty catch blocks)

### Form Validation

Use `react-hook-form` + `zod` schemas. Validate at the boundary, not deep inside business logic.

---

## PR Checklist (Quick Reference)

Copy this into PR descriptions:

```markdown
### Review Checklist
- [ ] No `supabase.from()` or `supabase.rpc()` — all access via `callRpc()`
- [ ] New RPC functions added to `ALLOWED_FUNCTIONS` whitelist
- [ ] SQL: JWT claim NULL guards, `FOR UPDATE` locks, tenant isolation
- [ ] No `any` types introduced
- [ ] No `console.log` in production code
- [ ] Files under 800 lines
- [ ] Component names prefixed with module name
- [ ] TanStack Query for all server data
- [ ] Tests included for new functionality
```
