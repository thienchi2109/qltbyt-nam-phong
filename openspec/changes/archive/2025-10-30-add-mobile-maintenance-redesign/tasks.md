## 1. Mobile experience scaffolding
- [x] 1.1 Add feature flag and responsive guard in `maintenance/page.tsx` to load MobileMaintenance when enabled on handheld viewports.
- [x] 1.2 Create shared hooks/utilities for mobile detection, debounced search, and filter badge counts without regressing desktop behavior.

## 2. Mobile maintenance UI
- [x] 2.1 Implement sticky mobile header with integrated search, clear affordance, and filter trigger respecting safe-area padding.
- [x] 2.2 Build filter bottom sheet with facility selector, apply/clear actions, and active filter chips tied to server-side queries.
- [x] 2.3 Replace desktop plan table on mobile with card-based list showing status color bands, primary actions, and skeleton/empty states.
- [x] 2.4 Add fixed bottom pagination bar with large touch targets, safe-area aware spacing, and plan count display.

## 3. Task interactions & state management
- [x] 3.1 Implement expandable task cards with month badges, inline actions, and support for completion states.
- [x] 3.2 Surface unsaved-change banner with save/cancel actions and integrate with existing draft persistence.
- [x] 3.3 Ensure mutations (approve/reject/save) preserve mobile UI state and trigger appropriate toasts.

## 4. Quality & rollout
- [x] 4.1 Add loading skeletons, reduced-motion handling, and haptic hooks (no-op fallback) per checklist.
- [x] 4.2 Verify accessibility (touch targets ≥44px, focus order, voice-over labels) and run Lighthouse mobile audits.
- [x] 4.3 Document feature flag rollout plan and analytics instrumentation before requesting approval to launch.
