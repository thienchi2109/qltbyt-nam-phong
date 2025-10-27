# Testing Guide — Reports Inventory Unified Dynamic Chart

## Objectives
Validate role gating, mode switching, Top 10 handling, UX messages, accessibility, and stability.

## Test Matrix

### Roles
- regional_leader (scoped)
- global (unscoped)
- other roles (viewer/department-level): chart must not render

### Modes
- All facilities (`tenantFilter === 'all'`)
- Single facility (specific facility id)

## Scenarios

1) Visibility by role
- Login as regional_leader → unified chart is visible.
- Login as global → unified chart is visible.
- Login as other role → unified chart is not rendered.

2) Mode switching
- As RL/global, switch facility dropdown between:
  - All → Facilities Distribution appears (bar chart).
  - Specific facility → Per-facility Interactive chart appears.
- Assert telemetry `mode_switched` fired with correct from/to.

3) All-mode data & sorting
- Verify bars sorted by current stock desc; name asc tie-breaker.
- Validate Top 10 default: only 10 bars rendered if >10 facilities.

4) Show all toggle
- Click “Hiển thị tất cả” → all facilities rendered; horizontal scroll appears when needed.
- Click “Thu gọn” → back to Top 10.
- Assert telemetry `show_all_toggled` with correct state.

5) Messages
- All-mode (global): message mentions “trên toàn hệ thống”.
- All-mode (regional_leader): message mentions “trong phạm vi của bạn”.
- Single-mode: message displays “Biểu đồ tương tác cho cơ sở đã chọn.”

6) Empty states
- All-mode: simulate `get_facilities_with_equipment_count()` returning empty → “Không có dữ liệu tồn kho theo cơ sở trong phạm vi của bạn.”
- Single-mode: reuse existing empty handling (no regression).

7) Error handling
- Force RPC failure → user-friendly error (toast/alert); no crash. Logs contain details.

8) Accessibility
- Keyboard navigation to the toggle.
- Focus-visible outline present.
- aria-label reflects current mode.
- Tooltip accessible on keyboard focus.

9) Performance
- All-mode initial render under target (e.g., < 2s typical data volumes).
- Show all with large facility counts remains responsive; check layout stability.

10) Regression checks
- Ensure other Inventory charts/tables behave as before.
- Switching tabs and returning preserves expected state.

## Manual QA Checklist
- [ ] RL/global → unified chart visible; others hidden.
- [ ] All→Single and Single→All switching updates chart correctly.
- [ ] Top 10 default works; Show all expands/collapses.
- [ ] Messages correct per role and mode, localized.
- [ ] Loading/empty/error states correct.
- [ ] A11y verified (keyboard focus, labels, contrast).
- [ ] No console errors; telemetry events captured.

## Notes
- This feature is FE-only; backend scope enforcement relies on existing RPC behavior.
