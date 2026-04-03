## ADDED Requirements

### Requirement: Equipments page canonical detail and edit surface
The system SHALL use `EquipmentDetailDialog` as the only details and edit surface on the `/equipment` catalog page.

#### Scenario: Row action opens the canonical detail surface
- **WHEN** a user chooses `Xem chi tiết` for an equipment row on the `Equipments` page
- **THEN** the system opens `EquipmentDetailDialog` for that record
- **AND** any permitted edit action is performed from that same dialog surface

#### Scenario: Save stays within the detail surface
- **WHEN** a permitted user saves equipment changes from inline edit mode on the `Equipments` page
- **THEN** the detail dialog remains the active surface for that record
- **AND** the page refreshes the active equipment-list data for the current tenant
- **AND** the open detail surface continues showing the saved user-visible values until refetch completes

### Requirement: Equipments page dialog orchestration excludes the legacy standalone edit path
The system SHALL not mount or route `/equipment` page dialog state through the standalone `EditEquipmentDialog`.

#### Scenario: Equipment page dialog tree loads
- **WHEN** the `Equipments` page renders its dialog orchestration
- **THEN** add, import, detail, delete, and usage dialogs remain available as applicable
- **AND** the standalone legacy edit dialog is not mounted for that route

#### Scenario: Equipment page invalidation uses the current catalog contract
- **WHEN** a detail-driven equipment update succeeds on the `Equipments` page
- **THEN** the route invalidates the active `equipment_list_enhanced` catalog data contract
- **AND** it does not depend on the legacy `equipment_list` refresh path

### Requirement: Shared equipment edit contract across canonical consumers
The system SHALL keep one shared validation, normalization, and update contract for equipment edit flows even after route-specific legacy shells are removed.

#### Scenario: Shared field behavior stays aligned
- **WHEN** a field such as `so_luu_hanh` or `ngay_ngung_su_dung` is edited from the `Equipments` page detail dialog or any later canonical consumer
- **THEN** the same schema, default-value mapping, and RPC update contract are applied

#### Scenario: Shared update contract keeps route-specific refresh behavior separate
- **WHEN** the shared equipment edit contract is used by multiple routes
- **THEN** validation, normalization, and update behavior remain shared
- **AND** route-specific cache invalidation remains owned by each consuming route
