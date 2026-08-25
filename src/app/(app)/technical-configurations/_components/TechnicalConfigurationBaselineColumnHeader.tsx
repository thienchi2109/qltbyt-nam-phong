import {
  TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_COLUMNS,
  TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH,
  TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE,
} from "./TechnicalConfigurationBaselineCriterionRow"

/** Labels the hierarchy canvas columns once for all baseline groups. */
export function TechnicalConfigurationBaselineColumnHeader(): React.JSX.Element {
  return (
    <div className="sticky top-0 z-20 overflow-x-auto border-b bg-muted/95">
      <div
        aria-label="Cột cấu hình cơ sở"
        data-testid="baseline-editor-column-header"
        data-grid-template={TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE}
        className={`ml-6 grid ${TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_COLUMNS} ${TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH} pl-4 text-xs font-semibold text-muted-foreground`}
      >
        <span aria-hidden="true" />
        <span className="px-2 py-2.5 text-center">STT</span>
        <span className="px-2 py-2.5">Mã</span>
        <span className="px-2 py-2.5">Tiêu đề</span>
        <span className="px-2 py-2.5">Yêu cầu</span>
        <span className="px-2 py-2.5 text-center">Trạng thái</span>
        <span className="px-2 py-2.5 text-center">Thao tác</span>
      </div>
    </div>
  )
}
