# OpenSpec: Reports Inventory — Unified Dynamic Chart

- ID: 2025-10-27-reports-unified-inventory-chart
- Status: Proposed
- Date: 2025-10-27
- Owners: Reports/Inventory FE + BE
- Related: openspec/changes/archive/2025-10-27-fix-reports-all-facilities-aggregation

## Summary
Unify the Inventory tab’s chart experience for regional_leader and global users into a single dynamic chart:
- When viewing all facilities, show Facilities Equipment Distribution (current stock per facility), default Top 10 with a “Show all” toggle and a friendly role-aware message.
- When viewing a single facility, show the existing interactive per-facility chart (department/location breakdown, cross-filtering).

This change is FE-only. It reuses the role-aware RPC get_facilities_with_equipment_count for the all-facilities snapshot. No migrations.

## Rationale
- Consistent, discoverable UX for RL/global across modes.
- Eliminates chart gaps in all-facilities view while preserving depth in single-facility view.
- Reduces duplication by consolidating chart logic.

## Scope
- Audience: regional_leader (scoped to allowed facilities) and global (all facilities). Hidden for other roles.
- Data semantics (all): current stock per facility (snapshot), unsliced by date/department.
- Data semantics (single): existing interactive chart unchanged.

## Deliverables
- proposal.md (this folder)
- IMPLEMENTATION.md (detailed plan, integration touches, i18n, a11y, telemetry)
- TESTING_GUIDE.md (unit/integration/QA)
- (Optional post-merge) COMPLETION.md when shipped

## Rollout Plan
1) Implement behind a small FE flag (optional), default enabled for RL/global.
2) Validate on staging with representative facility counts.
3) Monitor telemetry (render time, toggles) and error logs.

## Risks
- Many facilities: addressed by Top 10 default and horizontal scroll in “Show all”.
- Long labels: truncation with tooltip.
- Scope leakage: rely on the existing role-aware RPC; no new endpoints.

## Acceptance (summary)
- Unified chart renders only for RL/global.
- Auto-switch by tenant selection: all → facilities distribution; single → interactive.
- All-mode defaults to Top 10; toggle expands to all; sorted by stock desc, then name asc.
- Friendly localized messages and accessible controls.
- Loading/empty/error states covered.
