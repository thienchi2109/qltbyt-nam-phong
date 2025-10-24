## MODIFIED Requirements

### Requirement: Mobile Floating Action Button (Repair Requests)
The page SHALL present a floating "Tạo yêu cầu" button on mobile that stays above the bottom navigation and within the device safe area.

#### Scenario: FAB above footer and safe to tap
- **WHEN** viewing on a mobile device with a bottom navbar
- **THEN** the FAB appears above the navbar with sufficient spacing and a higher stacking order
- **AND** it respects `safe-area-inset-bottom` so it never overlaps system bars

---

### Requirement: Summary Cards Visual Tone (Repair Requests)
Summary cards SHALL use pastel backgrounds corresponding to their status tone while maintaining legible text.

#### Scenario: Pastel status tones
- **WHEN** displaying counts for Chờ xử lý/Đã duyệt/Hoàn thành/Không HT
- **THEN** cards use warning/muted/success/danger pastel backgrounds respectively, with readable text
