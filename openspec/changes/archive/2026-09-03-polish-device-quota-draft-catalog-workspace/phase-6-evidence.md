# Phase 6 Release Evidence

## Scope

- Change: `polish-device-quota-draft-catalog-workspace`
- Phase: 6 only
- Exact verification commit: the commit containing this file; the pushed SHA is
  recorded in the implementation handoff
- Runtime production changes: none
- Database/API/migration/permission changes: none
- Mobile/business-rule/active-category/import changes: none
- Issue `#982`: not absorbed; the existing React-complexity warning remains out
  of scope
- Browser/Playwright: intentionally not used
- Automated interaction driver: `@testing-library/user-event`

## Equivalent Visual Evidence

The Phase 6 test
`DeviceQuotaDraftCatalogPhase6.test.tsx` renders the real editor in jsdom and
emits each requested workspace width through the production `ResizeObserver`
path. The `window.innerWidth` fallback is deliberately set on the opposite side
of the `1200px` breakpoint, so the layout assertions cannot pass by exercising
the fallback alone. The test checks the reviewable DOM/layout contracts but
does not claim browser pixel metrics, because jsdom does not perform CSS
layout.

| Viewport                                     | Structure default | Expanded structure behavior                                          | Grid/scroll/save checks                                                                       | Result |
| -------------------------------------------- | ----------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `1024px` width (`1024x768` evidence harness) | `48px` rail       | expands to `176px` overlay without changing the `48px` content track | 37 compact records, one shared expanded grid, independent vertical scroll region, top toolbar | PASS   |
| `1280x720`                                   | `176px` panel     | remains in panel mode                                                | 37 compact records, one shared expanded grid, independent vertical scroll region, top toolbar | PASS   |
| `1366x768`                                   | `176px` panel     | remains in panel mode                                                | 37 compact records, one shared expanded grid, independent vertical scroll region, top toolbar | PASS   |
| `1440x900`                                   | `176px` panel     | remains in panel mode                                                | 37 compact records, one shared expanded grid, independent vertical scroll region, top toolbar | PASS   |

The test also checks the expanded item uses the existing shared field-grid
contract.

## Quality Gate Results

Final results are re-run on the exact pushed commit before handoff.

| Gate                                     | Result                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| `format:check`                           | PASS                                                      |
| `verify:no-explicit-any`                 | PASS                                                      |
| `verify:dedupe`                          | PASS                                                      |
| `typecheck`                              | PASS                                                      |
| focused draft-catalog tests              | PASS, 5 files / 40 tests                                  |
| focused shared hierarchical-editor tests | PASS, 1 file / 5 tests                                    |
| Phase 6 viewport evidence                | PASS, 1 file / 4 `user-event` tests                       |
| `react-doctor` diff gate                 | PASS, 100/100, no issues in the changed test file         |
| React Doctor full score                  | 49, exit 0; repository baseline, not Phase 6 attributable |
| OpenSpec strict validation               | PASS                                                      |
| local DB quality gate                    | SKIP, no migration or gate-registry changes               |

## Gaps And Boundaries

- No browser screenshot or computed-style measurement is provided by design.
- jsdom evidence verifies the responsive state machine and structural CSS
  contracts, but not font rendering, actual line wrapping, or physical
  horizontal overflow in a browser.
- The React Doctor full-repository score is `49`. Phase 6 changes no production
  source, so resolving unrelated baseline findings would violate this phase
  boundary.
- No API, DB, migration, permission, validation, business-rule, mobile,
  active-category/import, or `#982` implementation work was performed.
