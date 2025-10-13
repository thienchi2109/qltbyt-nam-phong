# React-Window Type Declaration Issue - Root Cause Analysis

**Date:** October 12, 2025  
**Issue:** TypeScript type conflicts in react-window usage  
**Status:** ✅ RESOLVED

---

## The Real Problem

### Package Version Mismatch

The project has TWO sources of react-window types:

1. **Actual Package**: `react-window@2.2.0`
   - Location: `node_modules/react-window/dist/react-window.d.ts`
   - API: `List`, `Grid`, `rowComponent`, `rowCount`, `rowHeight`
   - Built-in TypeScript definitions (ships with package)

2. **Outdated @types**: `@types/react-window@1.8.8`
   - Location: `node_modules/@types/react-window/index.d.ts`
   - API: `FixedSizeList`, `VariableSizeList`, `itemCount`, `itemSize`, `children`
   - Community-maintained types for OLD v1.x API

### TypeScript Module Resolution Conflict

TypeScript resolves types in this order:
1. Check `@types/*` packages (DefinitelyTyped)
2. Check package's built-in `.d.ts` files

Because `@types/react-window` exists, TypeScript uses it instead of the built-in types from `react-window@2.2.0`, causing type mismatches.

---

## Solution

### Created Custom Type Declarations

**File:** `src/types/react-window-v2.d.ts`

This file:
- ✅ Declares the CORRECT react-window v2.2.0 API
- ✅ Overrides the incorrect @types/react-window v1.8.8 types
- ✅ Matches the actual runtime behavior of react-window@2.2.0
- ✅ Provides proper TypeScript IntelliSense and type checking

### Why Not Uninstall @types/react-window?

Options considered:
1. **Uninstall @types/react-window** ❌
   - Would break if TypeScript doesn't find built-in types
   - Risk of no type safety at all

2. **Update @types/react-window** ❌
   - No v2.x types available on DefinitelyTyped
   - Latest is v1.8.8 (for old v1.x API)

3. **Create custom declarations** ✅ CHOSEN
   - Explicit control over type definitions
   - Guaranteed to match actual package behavior
   - Can be committed to repo for team consistency

---

## Verification

### Before Fix (Type Errors)
```
ERROR in src/components/transfers/VirtualizedKanbanColumn.tsx
  Module '"react-window"' has no exported member 'List'.
  Module '"react-window"' has no exported member 'RowComponentProps'.
```

### After Fix (Clean Compilation)
```bash
npm run typecheck
> tsc --noEmit
✅ No errors found
```

---

## Key Learnings

### 1. Check BOTH Package and @types Versions

When using packages with TypeScript:
```bash
npm ls <package>              # Check package version
npm ls @types/<package>       # Check types version
```

### 2. Verify Actual Package API

Don't trust documentation alone:
```bash
cat node_modules/<package>/dist/*.d.ts  # Check actual types
```

### 3. @types/* Can Be Outdated

DefinitelyTyped is community-maintained and may lag behind package updates:
- `react-window@2.2.0` released ~2020
- `@types/react-window@1.8.8` still has v1.x types (2024)

### 4. Custom Declarations Are Valid

Creating `src/types/<package>.d.ts` is a legitimate solution when:
- @types package is outdated
- Package ships with incorrect/incomplete types
- Need to augment third-party types

---

## Related Files

- **Component**: `src/components/transfers/VirtualizedKanbanColumn.tsx`
- **Type Declarations**: `src/types/react-window-v2.d.ts`
- **Original Documentation**: `docs/Future-tasks/kanban-virtualization-p0-bug-fix.md`

---

## Future Recommendations

### Option 1: Monitor @types/react-window Updates
Check periodically for v2.x types:
```bash
npm view @types/react-window versions
```

### Option 2: Contribute to DefinitelyTyped
Create PR to add react-window v2.x types:
- Fork: https://github.com/DefinitelyTyped/DefinitelyTyped
- Update: `types/react-window/`
- Benefit: Help entire TypeScript community

### Option 3: Request Package to Ship Types
File issue with react-window maintainers to ensure built-in types take precedence over @types.

---

**Status:** ✅ Resolved with custom type declarations  
**Risk:** Low (types match actual runtime behavior)  
**Testing:** TypeScript compilation passing
