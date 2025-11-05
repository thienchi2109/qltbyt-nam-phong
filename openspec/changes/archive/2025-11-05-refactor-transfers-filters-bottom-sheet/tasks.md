## 1. Update Transfers Page Filter Presentation
- [x] 1.1 Import `useIsMobile` hook in `src/app/(app)/transfers/page.tsx`
- [x] 1.2 Add `isMobile` detection using `useIsMobile()` hook
- [x] 1.3 Pass `variant={isMobile ? "sheet" : "dialog"}` prop to `FilterModal` component
- [x] 1.4 Test on mobile viewport to verify bottom sheet presentation
- [x] 1.5 Test on desktop viewport to verify dialog presentation
- [x] 1.6 Verify all filter interactions work correctly in both modes:
  - [x] Status multi-select toggles
  - [x] Date range selection
  - [x] Filter chips display and removal
  - [x] Clear all functionality
  - [x] Filter persistence across reloads
- [x] 1.7 Run `npm run typecheck` to ensure no type errors
- [x] 1.8 Test with different user roles (global, regional_leader, to_qltb) to ensure facility filter remains in toolbar

## 2. Verification and Testing
- [x] 2.1 Compare UX with Equipment and Repair Requests pages for consistency
- [x] 2.2 Test touch interactions on mobile device or browser emulation
- [x] 2.3 Verify filter modal z-index doesn't conflict with other UI elements
- [x] 2.4 Test keyboard navigation and accessibility (Escape to close, focus trap)
- [x] 2.5 Verify smooth animation transitions on sheet open/close
