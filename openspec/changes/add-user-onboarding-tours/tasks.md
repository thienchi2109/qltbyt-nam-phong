## 1. Setup & Dependencies
- [ ] 1.1 Install driver.js package (`npm install driver.js`)
- [ ] 1.2 Create `src/components/onboarding/` directory structure

## 2. Core Onboarding Infrastructure
- [ ] 2.1 Create `use-tour.ts` hook for tour state management
- [ ] 2.2 Create `tour-configs.ts` with tour step definitions
- [ ] 2.3 Create `onboarding-styles.css` for custom Driver.js styling (Vietnamese theme)
- [ ] 2.4 Create `help-button.tsx` component for header integration

## 3. Dashboard Welcome Tour Implementation
- [ ] 3.1 Add `data-tour-kpi-cards` attribute to KPICards component
- [ ] 3.2 Add `data-tour-quick-actions` attribute to dashboard quick actions
- [ ] 3.3 Add `data-tour-qr-scanner` attribute to QR scanner button
- [ ] 3.4 Add `data-tour-dashboard-tabs` attribute to DashboardTabs component
- [ ] 3.5 Add `data-tour-navigation` attribute to mobile footer nav
- [ ] 3.6 Define Dashboard Welcome Tour steps in tour-configs.ts

## 4. Header Integration
- [ ] 4.1 Locate app header component
- [ ] 4.2 Add HelpButton component to header (next to user menu)
- [ ] 4.3 Implement tour trigger on button click

## 5. localStorage Persistence
- [ ] 5.1 Implement `useLocalStorage` hook for tour completion tracking
- [ ] 5.2 Store completion state per tour ID (`tour_dashboard_completed`)
- [ ] 5.3 Add reset functionality for replaying tours

## 6. Testing & Validation
- [ ] 6.1 Test tour on desktop viewport
- [ ] 6.2 Test tour on mobile viewport (responsive positioning)
- [ ] 6.3 Test tour interruption and resume behavior
- [ ] 6.4 Verify localStorage persistence across sessions
- [ ] 6.5 Run `npm run typecheck` to ensure no TypeScript errors

## 7. Documentation
- [ ] 7.1 Add inline comments to tour configuration
- [ ] 7.2 Update this tasks.md with completion status
