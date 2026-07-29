## ADDED Requirements

### Requirement: Liquidation equipment forms a final result group

When liquidation-last ordering is enabled, the system MUST place equipment
after all non-matching equipment only when both the normalized management
department is `VT-TBYT- KHO THANH LÍ` and the trimmed current status is
`Ngưng sử dụng`.

#### Scenario: General Equipments list keeps the liquidation group last

- **GIVEN** the main Equipments result contains normal rows and exact
  liquidation-condition rows
- **WHEN** the list requests `p_liquidation_last = true`
- **THEN** all normal rows appear before every liquidation row
- **AND** the grouping is applied before pagination

#### Scenario: A partial condition does not enter the liquidation group

- **GIVEN** equipment matches only the department or only the status
- **WHEN** the list requests `p_liquidation_last = true`
- **THEN** that equipment remains in the normal requested-sort group

### Requirement: Liquidation rows use decommission-date chronology

Within the liquidation group, the system MUST order normalized non-blank
`ngay_ngung_su_dung` ISO values ascending so newer dated rows appear after older
dated rows. This requirement defines date-cohort chronology and does not
guarantee exact warehouse-entry order within one date or for rows retaining an
old or missing decommission date.

#### Scenario: The newest decommission-date cohort appears last in the group

- **GIVEN** liquidation rows have older ISO decommission dates and one row has
  the newest ISO decommission date
- **WHEN** the list requests `p_liquidation_last = true`
- **THEN** the row with the newest decommission date appears after the older
  dated liquidation rows

#### Scenario: Legacy missing dates precede dated liquidation rows

- **GIVEN** a liquidation row has a null or blank `ngay_ngung_su_dung`
- **AND** other liquidation rows have valid ISO dates
- **WHEN** the list requests `p_liquidation_last = true`
- **THEN** the null or blank legacy row appears before the dated liquidation
  rows
- **AND** no data backfill is required

#### Scenario: Requested sort is limited to a chronology cohort

- **GIVEN** liquidation rows have different decommission dates
- **WHEN** the user requests a sortable column and direction
- **THEN** decommission-date chronology remains stronger than the requested
  sort
- **AND** the requested sort orders rows only after the chronology key

#### Scenario: Same-date rows retain requested deterministic sorting

- **GIVEN** multiple liquidation rows share the same decommission date and have
  different values for the requested sortable column
- **WHEN** the user requests a sortable column and direction
- **THEN** those same-date rows follow the requested sort

#### Scenario: Equal chronology and sort values use equipment ID

- **GIVEN** multiple liquidation rows share the same decommission date and the
  same requested-sort value
- **WHEN** the list builds the final deterministic order
- **THEN** those rows are ordered by equipment ID ascending

#### Scenario: General-list chronology is applied before pagination

- **GIVEN** the general result spans multiple pages and contains liquidation
  rows with older and newer decommission dates
- **WHEN** the list requests `p_liquidation_last = true`
- **THEN** the newest dated liquidation cohort remains on the final applicable
  page
- **AND** liquidation rows are not reordered only within the current browser
  page

### Requirement: Warehouse filtering preserves liquidation chronology

Filtering the main Equipments list to the liquidation warehouse MUST NOT remove
or reverse the decommission-date chronology.

#### Scenario: Filtered liquidation warehouse keeps the newest row last

- **GIVEN** every visible filtered row matches the liquidation condition
- **WHEN** the user filters to `VT-TBYT- KHO THANH LÍ`
- **THEN** legacy and older dated rows appear before newer dated rows
- **AND** the newest dated row appears at the end of the complete filtered
  result

#### Scenario: Filtered chronology is applied before pagination

- **GIVEN** the filtered liquidation result spans multiple pages
- **WHEN** the newest dated row sorts beyond the current page
- **THEN** the newest dated row remains on the final applicable page
- **AND** it is not moved to the end of only the current browser page

### Requirement: Non-opted-in callers remain compatible

The system MUST preserve the existing ordering contract when
`p_liquidation_last` is false or omitted.

#### Scenario: Opt-out ordering remains unchanged

- **GIVEN** an RPC caller omits `p_liquidation_last` or passes `false`
- **WHEN** `equipment_list_enhanced` builds its order
- **THEN** it applies the validated requested sort without the liquidation
  grouping or chronology keys

#### Scenario: Only the main Equipments table opts in

- **GIVEN** export, transfer, maintenance-selection, cached-search, or other
  existing `equipment_list_enhanced` consumers
- **WHEN** they request equipment
- **THEN** they retain their existing order
- **AND** no frontend or API payload change is required
