import {
  exactRecord,
  integerValue,
  nullableString,
  stringValue,
  uuidValue,
} from "./technical-configuration-result-export-decoders"
import type {
  TechnicalConfigurationResultExportCriterionAxisItemWire,
  TechnicalConfigurationResultExportOptionAxisItemWire,
} from "./technical-configuration-result-export-types"

const OPTION_AXIS_ITEM_KEYS =
  "option_id supplier_id supplier_name display_label model manufacturer option_name".split(" ")
const CRITERION_AXIS_ITEM_KEYS =
  "group_id group_name group_order criterion_id criterion_code criterion_title requirement_text criterion_order".split(
    " "
  )

/** Decode one exact ordered result-export option descriptor. */
export function decodeOptionAxisItem(
  value: unknown,
  index: number
): TechnicalConfigurationResultExportOptionAxisItemWire {
  const path = `option_axis.data[${index}]`
  const item = exactRecord(value, OPTION_AXIS_ITEM_KEYS, path)
  return {
    option_id: uuidValue(item.option_id, `${path}.option_id`),
    supplier_id: uuidValue(item.supplier_id, `${path}.supplier_id`),
    supplier_name: stringValue(item.supplier_name, `${path}.supplier_name`),
    display_label: stringValue(item.display_label, `${path}.display_label`),
    model: nullableString(item.model, `${path}.model`),
    manufacturer: nullableString(item.manufacturer, `${path}.manufacturer`),
    option_name: nullableString(item.option_name, `${path}.option_name`),
  }
}

/** Decode one exact ordered result-export criterion descriptor. */
export function decodeCriterionAxisItem(
  value: unknown,
  index: number
): TechnicalConfigurationResultExportCriterionAxisItemWire {
  const path = `criterion_axis.data[${index}]`
  const item = exactRecord(value, CRITERION_AXIS_ITEM_KEYS, path)
  return {
    group_id: uuidValue(item.group_id, `${path}.group_id`),
    group_name: stringValue(item.group_name, `${path}.group_name`),
    group_order: integerValue(item.group_order, `${path}.group_order`),
    criterion_id: uuidValue(item.criterion_id, `${path}.criterion_id`),
    criterion_code: stringValue(item.criterion_code, `${path}.criterion_code`),
    criterion_title: nullableString(item.criterion_title, `${path}.criterion_title`),
    requirement_text: stringValue(item.requirement_text, `${path}.requirement_text`),
    criterion_order: integerValue(item.criterion_order, `${path}.criterion_order`),
  }
}
