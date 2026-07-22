/** Canonical department label used to identify the liquidation warehouse. */
export const LIQUIDATION_DEPARTMENT_NAME = "VT-TBYT- KHO THANH LÍ"
/** Canonical equipment status used for decommissioned equipment. */
export const DECOMMISSIONED_EQUIPMENT_STATUS = "Ngưng sử dụng"

interface EquipmentLiquidationStateValues {
  khoa_phong_quan_ly?: string | null
  tinh_trang_hien_tai?: string | null
}

function normalizeDepartmentScope(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .replace(/-+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi-VN")
}

const NORMALIZED_LIQUIDATION_DEPARTMENT = normalizeDepartmentScope(LIQUIDATION_DEPARTMENT_NAME)

/** Returns whether the equipment satisfies both liquidation-list conditions. */
export function isLiquidationEndState(
  values: EquipmentLiquidationStateValues | null | undefined
): boolean {
  return (
    normalizeDepartmentScope(values?.khoa_phong_quan_ly) === NORMALIZED_LIQUIDATION_DEPARTMENT &&
    (values?.tinh_trang_hien_tai ?? "").trim() === DECOMMISSIONED_EQUIPMENT_STATUS
  )
}

/** Returns whether an edit moved equipment into the liquidation-list end state. */
export function didEnterLiquidationEndState(
  before: EquipmentLiquidationStateValues | null | undefined,
  after: EquipmentLiquidationStateValues | null | undefined
): boolean {
  return !isLiquidationEndState(before) && isLiquidationEndState(after)
}
