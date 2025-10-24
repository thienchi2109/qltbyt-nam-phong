## 1. Implementation
- [ ] 1.1 Create local persistence helpers (`src/lib/rr-prefs.ts`) for:
  - [ ] Column visibility, density, text wrap
  - [ ] Filter state (status, facility when permitted, date range)
  - [ ] Saved filter sets per user (optional)
- [ ] 1.2 Build FilterChips component (`_components/FilterChips.tsx`)
- [ ] 1.3 Build FilterModal component (`_components/FilterModal.tsx`)
- [ ] 1.4 Integrate filters into `page.tsx` with local persistence (no RPC behavior change yet)
- [ ] 1.5 Add column presets (Compact/Standard/Full) and wire TanStack columnVisibility
- [ ] 1.6 Add density and text-wrap toggles; persist values
- [ ] 1.7 Implement sticky leading columns (first two) with header alignment
- [ ] 1.8 Add SLA left-border stripe for non-completed rows (uses existing date helper)
- [ ] 1.9 Add keyboard shortcuts: `/` focus search, `n` open create (permitted roles), `Enter` open focused row
- [ ] 1.10 Desktop details as right-side Sheet; keep Dialog on mobile
- [ ] 1.11 Optional: saved filter sets (save/apply/delete) per user
- [ ] 1.12 Dashboard: reuse SummaryBar for repair KPIs with click-through filter navigation

## 2. Validation & QA
- [ ] Type safety: `npm run typecheck` passes
- [ ] Lint: `npm run lint` passes
- [ ] Filters: chips mirror modal; clear-all resets; persistence across reloads
- [ ] Roles: facility filter visible only for `global`/`regional_leader`; `n` shortcut gated appropriately
- [ ] Table: presets apply; density/wrap persist; sticky columns and headers align; smooth horizontal scroll
- [ ] SLA: left-border colors correct and hidden for completed/"Không HT"
- [ ] Shortcuts: do not interfere inside inputs/contentEditable
- [ ] Details: Sheet on desktop, Dialog on mobile; Esc/backdrop close; independent scroll
- [ ] Dashboard: KPIs match counts; clicks navigate and apply status filter

## 3. Non-Goals / Removals
- [ ] CSV/XLSX export (out of scope)
- [ ] Desktop view-mode toggle and auto-collapse (not implemented; keep manual collapse)
