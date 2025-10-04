# Transfer Dialog Departments Fix - 2025-09-27

## Issue Resolved
✅ **Transfer dialog showing '[object Object]' in department dropdowns**

### Root Cause
- The `departments_list` RPC returns `{name: string}[]` format
- Transfer dialog incorrectly expected `string[]` format
- This caused React key duplication errors and display issues

### Error Messages
1. Console: "Encountered two children with the same key, `[object Object]`"
2. UI: Department dropdowns showing "[object Object]" instead of names
3. Auto-population of current department failing

### Solution Applied
Updated `src/components/add-transfer-dialog.tsx` line 114-115:

**Before (incorrect):**
```typescript
const deps = await callRpc<string[]>({ fn: 'departments_list', args: {} })
setDepartments((deps || []).filter(Boolean).map(String))
```

**After (correct):**
```typescript
const deps = await callRpc<{ name: string }[]>({ fn: 'departments_list', args: {} })
setDepartments((deps || []).map(x => x.name).filter(Boolean))
```

### Database Verification
- `departments_list()` RPC returns: `[{"name":"Dược"},{"name":"Khoa Dược"},{"name":"Khoa Xét Nghiệm"}]`
- Correctly extracts name properties to create string array

### Pattern Consistency
- Now matches the working pattern in `add-equipment-dialog.tsx` (line 124-125)
- Both components handle departments_list RPC consistently

### Testing Status
- ✅ TypeScript compilation passes
- ✅ Pattern matches working implementation
- ✅ RPC response format verified

### Impact
- Fixes department dropdown display in internal transfers
- Resolves React key duplication warnings
- Enables proper auto-population of current department
- Maintains consistent data handling across all components

This was a simple but critical data transformation fix that ensures proper rendering of department selections in transfer dialogs.