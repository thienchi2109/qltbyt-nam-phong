## 1. Update Transfers Page Filter Presentation
- [ ] 1.1 Import `useIsMobile` hook in `src/app/(app)/transfers/page.tsx`
- [ ] 1.2 Add `isMobile` detection using `useIsMobile()` hook
- [ ] 1.3 Pass `variant={isMobile ? "sheet" : "dialog"}` prop to `FilterModal` component
- [ ] 1.4 Test on mobile viewport to verify bottom sheet presentation
- [ ] 1.5 Test on desktop viewport to verify dialog presentation
- [ ] 1.6 Verify all filter interactions work correctly in both modes:
  - [ ] Status multi-select toggles
  - [ ] Date range selection
  - [ ] Filter chips display and removal
  - [ ] Clear all functionality
  - [ ] Filter persistence across reloads
- [ ] 1.7 Run `npm run typecheck` to ensure no type errors
- [ ] 1.8 Test with different user roles (global, regional_leader, to_qltb) to ensure facility filter remains in toolbar

## 2. Verification and Testing
- [ ] 2.1 Compare UX with Equipment and Repair Requests pages for consistency
- [ ] 2.2 Test touch interactions on mobile device or browser emulation
- [ ] 2.3 Verify filter modal z-index doesn't conflict with other UI elements
- [ ] 2.4 Test keyboard navigation and accessibility (Escape to close, focus trap)
- [ ] 2.5 Verify smooth animation transitions on sheet open/close
