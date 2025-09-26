# Project State Update (qltbyt-nam-phong) — 2025-09-26

## Recent Critical Fix: Mobile Dialog Crash Resolution

### Issue Resolved
✅ **Mobile browser crash when closing "Create Plan" dialog** from Dashboard → Maintenance navigation

### Root Cause Identified
**Select component with undefined value crashes mobile browsers during dialog cleanup**
- Crash occurred only when closing dialog WITHOUT selecting any option
- Selecting a value first prevented the crash
- Mobile browsers are more sensitive to inconsistent component state

### Solution Applied
Added default value to Select components in maintenance plan dialogs:
```typescript
defaultValues: {
  loai_cong_viec: "Bảo trì", // Prevents mobile crashes
}
```

### Files Modified
- `src/components/add-maintenance-plan-dialog.tsx`
- `src/components/edit-maintenance-plan-dialog.tsx`
- `src/app/(app)/maintenance/page.tsx` (simplified URL handling)
- `tsconfig.json` (excluded reference files)

## Current Project Status

### Tech Stack & Architecture
- Next.js (App Router), React, TypeScript
- Tailwind CSS + Radix UI (custom wrappers in `src/components/ui`)
- Auth: NextAuth v4
- Data: Supabase via RPC-only access
- State/query: @tanstack/react-query
- Path alias: `@/*`

### Key Modules Status
- ✅ **Maintenance module**: Fully functional with mobile-safe dialogs
- ✅ **Activity Logs**: Complete with v2 enhancements
- ✅ **Equipment management**: Working with mobile optimizations
- ✅ **User management**: Multi-tenant with role-based access

### Recent Completed Features
1. ✅ Activity Logs v2 with entity tracking and search
2. ✅ Mobile dialog/dropdown layering fixes
3. ✅ Security hardening with search_path protection
4. ✅ Mobile dialog crash resolution (Select default values)

### Development Standards Reinforced
- **Mobile-first testing**: Always test dialog interactions on mobile
- **Simple solutions**: Avoid over-engineering mobile-specific workarounds
- **Component state consistency**: Ensure all form fields have proper default values
- **Radix UI patterns**: Follow standard controlled component patterns

### Conventions & Rules
- RPC proxy for all database operations
- Multi-tenancy: filter by current tenant, validate role permissions
- TypeScript strict: no `any`, explicit types/returns
- UI: Tailwind-only styling, Radix components from `src/components/ui`
- **NEW**: Always provide default values for Select components in dialogs

### Testing Status
- ✅ TypeScript compilation passes
- ✅ Mobile dialog interactions work correctly
- ✅ Multi-tenant isolation maintained
- ✅ Performance optimizations active

### Branch Context
- Current branch: `feat/regional_leader` (up to date with origin)
- Recent commits include mobile dialog crash fix

### Key Learning
This issue taught us that **understanding exact failure conditions** (undefined Select value on mobile cleanup) leads to **simple, elegant solutions** rather than complex mobile-specific workarounds. The solution was adding a default value, not engineering complex state management.

## Commands
- Dev: `npm run dev`
- Typecheck: `npm run typecheck` (passes cleanly)

## Operational Notes
- Mobile-safe dialog patterns are now established
- Form components follow consistent default value patterns
- Reference files excluded from TypeScript checking for cleaner builds

Project is in excellent state with robust mobile compatibility and clean, maintainable codebase.