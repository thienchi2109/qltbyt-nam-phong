## Why
The existing maintenance page forces desktop tables and dropdowns onto mobile screens, leading to cramped layouts, hard-to-tap controls, and navigation conflicts that slow technicians using phones in the field. We need a dedicated mobile experience that aligns with the redesign brief and resolves the UX issues captured in the mobile analysis.

## What Changes
- Introduce a feature-flagged mobile maintenance experience that routes handset users to a dedicated interface with sticky header, touch-first search, and safe-area compliant layout.
- Replace desktop tables with card-based plan browsing, color-coded status indicators, and fixed bottom pagination optimized for one-thumb use.
- Provide mobile task interactions through expandable cards, unsaved-change banner, and filter bottom sheets with large touch targets and debounced search.
- Add supporting hooks/components (mobile wrappers, filter sheet, pagination, skeletons) while keeping desktop experience unchanged.

## Impact
- Affected specs: maintenance-mobile-experience (new)
- Affected code: `src/app/(app)/maintenance/page.tsx`, new mobile-specific components under `src/app/(app)/maintenance/mobile/*`, shared hooks for mobile detection/filter state, Tailwind utilities for safe-area/touch feedback.
- Feature flag and analytics: update configuration to gate rollout and capture usability metrics.
