import type {
  TechnicalConfigurationComparisonOption,
  TechnicalConfigurationComparisonOptionWire,
} from "./comparison-types"

/** Normalizes one comparison option for shared matrix and evaluation consumers. */
export function toTechnicalConfigurationComparisonOption(
  option: TechnicalConfigurationComparisonOptionWire
): TechnicalConfigurationComparisonOption {
  return {
    id: option.id,
    supplierId: option.supplier_id,
    supplierName: option.supplier_name,
    model: option.model,
    manufacturer: option.manufacturer,
    optionName: option.option_name,
    displayLabel: option.display_label,
  }
}
