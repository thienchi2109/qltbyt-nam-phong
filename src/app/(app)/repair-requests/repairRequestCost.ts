const REPAIR_COST_ERROR_MESSAGE = "Chi phí sửa chữa không hợp lệ"

function isAsciiDigits(value: string) {
  return /^[0-9]+$/.test(value)
}

function normalizeRepairCostRawValue(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return ""
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
