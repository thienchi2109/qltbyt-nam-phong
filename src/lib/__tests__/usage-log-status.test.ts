import { describe, expect, it } from "vitest"

import {
  getUsageLogFinalStatus,
  getUsageLogInitialStatus,
} from "../usage-log-status"

describe("usage-log-status", () => {
  it("prefers split status fields when present", () => {
    const usageLog = {
      tinh_trang_ban_dau: "Tốt",
      tinh_trang_ket_thuc: "Cần kiểm tra",
      tinh_trang_thiet_bi: "Legacy",
    }

    expect(getUsageLogInitialStatus(usageLog)).toBe("Tốt")
    expect(getUsageLogFinalStatus(usageLog)).toBe("Cần kiểm tra")
  })

  it("falls back to legacy status when split fields are null", () => {
    const usageLog = {
      tinh_trang_ban_dau: null,
      tinh_trang_ket_thuc: null,
      tinh_trang_thiet_bi: "Tình trạng cũ",
    }

    expect(getUsageLogInitialStatus(usageLog)).toBe("Tình trạng cũ")
    expect(getUsageLogFinalStatus(usageLog)).toBe("Tình trạng cũ")
  })

  it("returns null when no status field is available", () => {
    expect(getUsageLogInitialStatus({})).toBeNull()
    expect(getUsageLogFinalStatus({})).toBeNull()
  })
})
