# Temporary Rollback Plan

## If you can't apply the migration immediately:

1. **Revert transfers page** to use old `useTransferRequests` hook
2. **Remove FilterBar** temporarily
3. **Keep old client-side filtering**

This will get the page working again while you apply the migration.

## Commands to rollback:

```bash
# Show what changed
git diff src/app/(app)/transfers/page.tsx

# Revert just the transfers page
git checkout HEAD~1 -- src/app/(app)/transfers/page.tsx
```

## But the BETTER solution is:

**Just apply the migration!** It takes 30 seconds in Supabase SQL Editor.

The migration file is ready at:
`supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_side_filtering.sql`

Copy the entire content and paste into Supabase SQL Editor → Run.
