## Context
The equipment module already tracks lifecycle-related dates such as `ngay_nhap`, `ngay_dua_vao_su_dung`, and `han_bao_hanh`. Those fields support flexible partial dates, but `ngay_ngung_su_dung` represents a concrete lifecycle event and therefore needs full-date precision. The field must flow through DB/RPC writes, date utilities, import/export, UI forms, table/detail displays, and print output.

## Goals / Non-Goals
- Goals:
  - Record when a device stops being used with strict full-date precision.
  - Preserve data integrity by validating at both client and RPC layers.
  - Prevent invalid combinations where a non-decommissioned device still carries a decommission date.
  - Support the field in CRUD, import, export, detail, table, and print flows.
- Non-Goals:
  - No automatic backfill of existing `"Ngưng sử dụng"` records.
  - No search/filter work for this field in this change.
  - No AI integration in this change.
  - No changes to general equipment read RPC projections beyond what is already returned via `SELECT *` / `to_jsonb(tb.*)`.

## Decisions
- Decision: **Use client + RPC validation**, not client-only validation.
  - Rationale: bulk import and any future callers must obey the same rule set as the UI.
- Decision: **`ngay_ngung_su_dung` is only valid when `tinh_trang_hien_tai = "Ngưng sử dụng"`**.
  - Rationale: a decommission date on an active or non-decommissioned device is contradictory lifecycle data.
- Decision: **Reject invalid import/save attempts instead of silently clearing the field**.
  - Rationale: silent correction would hide source-data problems and make imports harder to audit.
- Decision: **Existing decommissioned records may be manually backfilled, but never auto-backfilled on load**.
  - Rationale: users need a path to correct historical records without the system inventing dates for them.
- Decision: **Strict full-date handling uses dedicated helpers**, not the permissive partial-date helpers or generic import fallback.
  - Rationale: `MM/YYYY`, `YYYY`, and broad `Date.parse` fallback would weaken the agreed requirement.
- Decision: **Auto-set is transition-aware**.
  - Rationale: the field should auto-fill only when the user changes status to `"Ngưng sử dụng"` in the current session, not when an existing legacy record simply loads with that status.
- Decision: **Excel template validation is UX guidance only; import + RPC remain authoritative**.
  - Rationale: users can still paste data from external files or bypass template hints.
- Decision: **AI is out of scope for now, but explicitly noted for a future follow-up**.
  - Rationale: current product need is equipment CRUD/import/display; AI lookup can be added in a focused subsequent change.

## Risks / Trade-offs
- Validation now exists in more than one layer (form, import, RPC), so rules must stay synchronized.
  - Mitigation: use shared helper semantics and add explicit tests for import and RPC behavior.
- Transition-aware auto-set is slightly more complex than a naive `watch()` effect.
  - Mitigation: track prior status per session and document the non-backfill rule clearly.
- Excel template custom validation improves usability but will not stop every malformed external file.
  - Mitigation: reject invalid rows during import with a clear row-level error.

## Migration Plan
1. Add the nullable DB column.
2. Update equipment write RPCs to persist and validate the field.
3. Add strict full-date helpers for forms/import.
4. Wire the field through import/export, forms, table/detail, and print output.
5. Add verification coverage for form/import/RPC behavior.

## Follow-up Note
- Future change: add `ngay_ngung_su_dung` to `ai_equipment_lookup` so users can query AI about equipment decommission dates.
