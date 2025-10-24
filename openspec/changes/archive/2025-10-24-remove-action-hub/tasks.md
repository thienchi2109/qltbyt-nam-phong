## 1. Implementation
- [x] Remove ResizableAside component and ExpandAsideButton import/usages in `src/app/(app)/repair-requests/page.tsx`
- [x] Remove aside-related state (viewMode, asideWidth, asideCollapsed) and persistence effects
- [x] Simplify content layout to `grid grid-cols-1 gap-4` (drop split grid + inline styles)
- [x] Empty `src/app/(app)/repair-requests/_components/ResizableAside.tsx`
- [x] Verify create flow via Sheet (desktop) and FAB (mobile) still works

## 2. Validation & QA
- [x] Type safety: `npm run typecheck` passes
- [ ] Lint: `npm run lint` passes (existing repository issues outside this change remain)
- [x] No references to `viewMode`/`aside*`/`ResizableAside` remain
- [x] Header: remove expand toggle; keep "Tạo yêu cầu" button
- [x] Mobile: list + FAB unaffected
