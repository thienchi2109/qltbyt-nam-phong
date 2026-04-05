import { describe, expect, it } from "vitest"

import { mapRepairRequestHistoryEntries } from "../_lib/repairRequestHistoryAdapter"

describe("mapRepairRequestHistoryEntries", () => {
  it("maps repair-request history rows into the shared change history contract", () => {
    const entries = [
      {
        id: 7,
        action_type: "repair_request_update",
        admin_username: "nva",
        admin_full_name: "Nguyễn Văn A",
        action_details: {
          trang_thai: "Đã duyệt",
          don_vi_thuc_hien: "noi_bo",
          ten_don_vi_thue: "",
          ly_do_khong_hoan_thanh: null,
        },
        created_at: "2026-04-05T02:00:00.000Z",
      },
    ]

    expect(mapRepairRequestHistoryEntries(entries)).toEqual([
      {
        id: "7",
        occurredAt: "2026-04-05T02:00:00.000Z",
        actionLabel: "Cập nhật yêu cầu sửa chữa",
        actorName: "Nguyễn Văn A",
        details: [
          { label: "Trạng thái", value: "Đã duyệt" },
          { label: "Đơn vị thực hiện", value: "noi_bo" },
        ],
      },
    ])
  })

  it("falls back gracefully when actor and details are missing", () => {
    const entries = [
      {
        id: 8,
        action_type: "repair_request_delete",
        admin_username: "system",
        admin_full_name: null,
        action_details: null,
        created_at: "2026-04-05T03:00:00.000Z",
      },
    ]

    expect(mapRepairRequestHistoryEntries(entries)).toEqual([
      {
        id: "8",
        occurredAt: "2026-04-05T03:00:00.000Z",
        actionLabel: "Xóa yêu cầu sửa chữa",
        actorName: null,
        details: [],
      },
    ])
  })
})
