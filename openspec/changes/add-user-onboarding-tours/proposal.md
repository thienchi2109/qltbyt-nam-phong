## Why

New users struggle to discover and understand the key features of CVMEMS (medical equipment management system). There is no guided introduction to help users navigate the dashboard, understand KPI metrics, use QR scanning, or access core workflows. This results in slower adoption and increased support requests.

## What Changes

- Add Driver.js library for interactive product tours
- Create a reusable onboarding tour system with React hooks
- Implement Dashboard Welcome Tour as the first priority tour
- Add a "Help" button in the app header to trigger tours manually
- Store tour completion state in localStorage
- Add `data-tour-*` attributes to key UI elements for tour targeting

## Impact

- Affected specs: NEW `user-onboarding` capability
- Affected code:
  - `src/components/onboarding/` (new directory)
  - `src/components/app-header.tsx` (add help button)
  - `src/app/(app)/dashboard/page.tsx` (add tour attributes)
  - `src/components/dashboard/kpi-cards.tsx` (add tour attributes)
  - `src/components/dashboard/dashboard-tabs.tsx` (add tour attributes)
  - `src/components/mobile-footer-nav.tsx` (add tour attributes)
  - `package.json` (add driver.js dependency)
