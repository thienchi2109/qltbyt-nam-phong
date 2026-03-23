## Context
The equipment module tracks device lifecycle dates: `ngay_nhap` (received), `ngay_dua_vao_su_dung` (commissioned), and `han_bao_hanh` (warranty). These use flexible partial date formats (YYYY, MM/YYYY, DD/MM/YYYY). The new `ngay_ngung_su_dung` tracks when a device ends service. Equipment data flows through 8 layers: DB → Types → Date Utils → Import/Export → UI Forms → Table → Print → AI.

## Goals / Non-Goals
- Goals:
  - Record when equipment is decommissioned with strict DD/MM/YYYY precision.
  - Auto-suggest today's date (UTC+7) when status changes to "Ngưng sử dụng".
  - Validate `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` at form level.
  - Support the field in all CRUD, import, and display flows.
- Non-Goals:
  - No backfill of existing "Ngưng sử dụng" records.
  - No filter/search on this field for now.
  - No changes to equipment list RPC query columns (relies on `SELECT *` or existing projection).

## Decisions
- Decision: **Strict DD/MM/YYYY** (not partial dates like other date fields).
  - Rationale: Decommission date is a specific event, not an approximation. Year-only or month-only precision is insufficient for audit trails.
- Decision: **New `isValidFullDate` + `normalizeFullDateForForm`** helpers in `date-utils.ts`.
  - Rationale: Reusing `isValidPartialDate` would allow MM/YYYY and YYYY, which violates the strict format requirement.
  - Alternatives: Using a date picker UI component (rejected: inconsistent with existing text-input pattern for all other date fields).
- Decision: **Auto-set via `watch` + `useEffect`**, not via Zod `default()`.
  - Rationale: Zod defaults fire at schema parse time, not on status change. react-hook-form `watch` reacts to user interaction.
- Decision: **UTC+7 via `Intl.DateTimeFormat`**, not `new Date().toLocaleDateString()`.
  - Rationale: `toLocaleDateString` depends on browser locale. `Intl.DateTimeFormat` with explicit `timeZone: 'Asia/Ho_Chi_Minh'` is deterministic.
- Decision: **Cross-field validation via `.superRefine()`** at Zod schema root.
  - Rationale: Standard `.refine()` on individual fields can't access sibling field values.
- Decision: **Hidden by default** in table column visibility.
  - Rationale: Most equipment is active; decommission date is rarely viewed in list context.

## Risks / Trade-offs
- `.superRefine()` adds schema complexity to 3 separate form schemas (Add, Edit, Detail). If schemas diverge, validation may become inconsistent. → Mitigation: consider extracting shared schema to a common module in the future.
- Auto-set only fires when field is empty; if user clears the date and re-selects "Ngưng sử dụng", auto-set won't re-fire. This is intentional (respects user intent).

## Migration Plan
1. Run Supabase migration to add column (no backfill).
2. Update TS types.
3. Add date helpers.
4. Wire through all 8 layers (bottom-up: types → utils → import → forms → table → print → AI → tests).

## Open Questions
- None (all requirements confirmed by product owner).
