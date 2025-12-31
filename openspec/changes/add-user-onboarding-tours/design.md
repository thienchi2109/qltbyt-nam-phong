## Context

CVMEMS is a Vietnamese medical equipment management system with multiple complex features. New users need guidance to understand the dashboard metrics, navigation, and core workflows. Driver.js is chosen as a lightweight, dependency-free solution for creating interactive product tours.

## Goals / Non-Goals

### Goals
- Provide an intuitive first-time user experience
- Reduce support requests for basic navigation questions
- Enable users to replay tours on demand via a Help button
- Support Vietnamese language throughout the tour
- Work seamlessly on both desktop and mobile viewports

### Non-Goals
- Auto-triggering tours on first login (deferred to future enhancement)
- Role-specific tour variations (all users see the same Dashboard tour)
- Server-side tour completion tracking (localStorage only for MVP)
- Multiple tours beyond Dashboard Welcome (future scope)

## Decisions

### Decision 1: Driver.js as the tour library
- **Rationale**: Lightweight (~5KB gzipped), no dependencies, vanilla JS with React compatibility, excellent documentation, MIT license
- **Alternatives considered**:
  - Shepherd.js: Heavier, more complex setup
  - React Joyride: React-specific but larger bundle
  - Custom implementation: Too much effort for MVP

### Decision 2: Manual trigger via Help button
- **Rationale**: User requested manual trigger; less intrusive than auto-start; users can replay anytime
- **Location**: App header, near user menu dropdown

### Decision 3: localStorage for completion tracking
- **Rationale**: Simple, no backend changes required, per-browser tracking sufficient for MVP
- **Key format**: `tour_<tourId>_completed: boolean`

### Decision 4: Data attributes for element targeting
- **Rationale**: Decouples tour logic from component internals; survives refactoring; explicit tour targets
- **Pattern**: `data-tour-<element-name>` (e.g., `data-tour-kpi-cards`)

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Elements may not exist when tour starts | Use Driver.js `onHighlightStarted` callback to skip missing elements |
| Mobile viewport positioning issues | Test thoroughly; use `side: 'over'` for modal steps on small screens |
| localStorage cleared by user | Acceptable for MVP; future: add database sync |
| Tour steps become stale after UI changes | Use semantic data attributes; update tour config when UI changes |

## Migration Plan

No migration needed - this is a new feature with no breaking changes.

## Open Questions

1. Should we add a "Don't show again" checkbox in the tour? (Deferred)
2. Should the Help button show a badge for first-time users? (Deferred)
