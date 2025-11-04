## 1. Planning & Alignment
- [ ] 1.1 Confirm no other active OpenSpec change touches transfers UI/API.
- [ ] 1.2 Review existing repair/maintenance grid implementations for reusable components.

## 2. Database / RPC Layer
- [ ] 2.1 Design SQL for `public.transfer_request_list` (filters, pagination, tenant scoping).
- [ ] 2.2 Implement `public.transfer_request_counts`.
- [ ] 2.3 Write migration SQL and run EXPLAIN on critical filters.
- [ ] 2.4 Add regression tests or psql snippets validating tenant isolation.

## 3. Next.js API Routes
- [ ] 3.1 Scaffold `/api/transfers/list` and `/api/transfers/counts`.
- [ ] 3.2 Update `/api/rpc/[fn]/route.ts` allowlist and null-handling as needed.
- [ ] 3.3 Remove kanban endpoint once grid is wired.

## 4. Frontend Refactor
- [ ] 4.1 Replace board layout with data grid, wiring TanStack Query to new endpoints.
- [ ] 4.2 Implement filter toolbar (facility, status multi-select, type, date range, search).
- [ ] 4.3 Render counts badge via counts endpoint; sync pagination state.
- [ ] 4.4 Ensure transfer actions (view, approve, edit, delete) still work and respect permissions.

## 5. QA & Rollout
- [ ] 5.1 Run `npm run typecheck` and `npm run lint`.
- [ ] 5.2 Smoke-test roles: global, regional_leader, to_qltb, technician, user.
- [ ] 5.3 Validate performance with large datasets (500+ rows).
- [ ] 5.4 Prepare release notes and coordinate rollout/flag removal.
