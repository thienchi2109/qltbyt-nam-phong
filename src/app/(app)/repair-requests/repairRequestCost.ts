const REPAIR_COST_ERROR_MESSAGE = "Chi phí sửa chữa không hợp lệ"
const THOUSANDS_GROUPED_PATTERN = /^[0-9]{1,3}([.\s])[0-9]{3}(?:\1[0-9]{3})*$/

function isAsciiDigits(value: string) {
  return /^[0-9]+$/.test(value)
}

function normalizeRepairCostRawValue(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return ""
  }

  if (!isAsciiDigits(trimmed) && !THOUSANDS_GROUPED_PATTERN.test(trimmed)) {
    throw new Error(REPAIR_COST_ERROR_MESSAGE)
  }

  const normalized = trimmed.replace(/[.\s]/g, "")

  if (!normalized || !isAsciiDigits(normalized)) {
    throw new Error(REPAIR_COST_ERROR_MESSAGE)
  }

  return normalized
}

export function parseRepairCostInput(input: string): number | null {
  const normalized = normalizeRepairCostRawValue(input)

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(REPAIR_COST_ERROR_MESSAGE)
  }

  return parsed
}

export function formatRepairCostInput(value: number | null): string {
  if (value === null) {
    return ""
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(REPAIR_COST_ERROR_MESSAGE)
  }

  return new Intl.NumberFormat("vi-VN").format(value)
}

export function formatRepairCostDisplay(value: number | null): string {
  if (value === null) {
    return "Chưa ghi nhận"
  }

  return `${formatRepairCostInput(value)} đ`
}
