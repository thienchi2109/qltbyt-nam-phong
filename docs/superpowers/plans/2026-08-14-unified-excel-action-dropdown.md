# Unified Excel Action Dropdown Implementation Plan

**Goal:** Replace the three visible baseline XLSX controls with one shared `Excel`
dropdown while reusing the proven Equipments dropdown behavior.

## Scope

- Extract the generic HeroUI action dropdown from the Equipments pilot wrapper into
  the approved shared `src/components/ui/heroui/` boundary.
- Migrate Equipments to the shared component without changing its labels, visibility,
  placement, or action behavior.
- Replace the baseline download/import button group with one `Excel` trigger containing
  current download, blank template, and hierarchy import actions.
- Preserve download serialization, disabled explanations, destructive import
  confirmation, deferred overlay actions, accessibility, responsive layout, and
  draft-only behavior.
- Do not change RPCs, parsers, workbook contracts, hierarchy import state, evaluation,
  comparison, or result export.

## TDD Steps

1. Move the existing Equipments dropdown behavior tests to the shared HeroUI boundary.
2. Change the production-isolation test to require one `Excel` trigger and three menu
   items.
3. Run both tests and confirm RED.
4. Add the shared dropdown component and migrate Equipments.
5. Fold baseline download state into the production action dropdown and remove the
   unreachable two-button component.
6. Update download tests to select menu items through the unified trigger.
7. Run focused tests, broad technical-configuration and Equipments regressions, required
   TypeScript/React gates, React Doctor, build, and diff review.

## Exit Criteria

- Exactly one visible `Excel` trigger appears beside `Khóa phiên bản`.
- The menu exposes all three XLSX actions with stable accessible names.
- Dirty, conflict, lifecycle, bulk-entry, and active-download states disable the trigger
  and retain the existing explanatory message.
- Import still opens the existing destructive hierarchy dialog after the menu closes.
- Equipments dropdown behavior is unchanged.
