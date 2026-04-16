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

  it("distinguishes Hoàn thành from Không HT for repair_request_complete", () => {
    // Given
    const entries = [
      {
        id: 20,
        action_type: "repair_request_complete",
        admin_username: "nva",
        admin_full_name: "Nguyễn Văn A",
        action_details: { trang_thai: "Hoàn thành", ket_qua_sua_chua: "Đã thay linh kiện" },
        created_at: "2026-04-06T05:00:00.000Z",
      },
      {
        id: 21,
        action_type: "repair_request_complete",
        admin_username: "nva",
        admin_full_name: "Nguyễn Văn A",
        action_details: { trang_thai: "Không HT", ly_do_khong_hoan_thanh: "Hết linh kiện" },
        created_at: "2026-04-06T06:00:00.000Z",
      },
    ]

    // When
    const result = mapRepairRequestHistoryEntries(entries)

    // Then
    expect(result[0].actionLabel).toBe("Hoàn thành sửa chữa")
    expect(result[1].actionLabel).toBe("Không hoàn thành sửa chữa")
  })

  it("preserves a legacy repair lifecycle timeline when only domain history has the full sequence", () => {
    const entries = [
      {
        id: 28,
        action_type: "repair_request_complete",
        admin_username: "system",
        admin_full_name: null,
        action_details: {
          trang_thai: "Hoàn thành",
          ket_qua_sua_chua: "thay pin cmos. Máy hoạt động được . Đang theo dõi.",
        },
        created_at: "2026-03-21T08:37:04.720432Z",
      },
      {
        id: 27,
        action_type: "repair_request_approve",
        admin_username: "system",
        admin_full_name: "Nguyễn Ngọc Du",
        action_details: {
          nguoi_duyet: "Nguyễn Ngọc Du",
          trang_thai: "Đã duyệt",
        },
        created_at: "2026-03-21T08:36:39.517454Z",
      },
      {
        id: 26,
        action_type: "repair_request_create",
        admin_username: "system",
        admin_full_name: "Nguyễn Ngọc Du",
        action_details: {
          trang_thai: "Chờ xử lý",
          nguoi_yeu_cau: "Nguyễn Ngọc Du",
        },
        created_at: "2026-03-21T08:36:34.593532Z",
      },
    ]

    expect(mapRepairRequestHistoryEntries(entries)).toEqual([
      {
        id: "28",
        occurredAt: "2026-03-21T08:37:04.720432Z",
        actionLabel: "Hoàn thành sửa chữa",
        actorName: null,
        details: [
          { label: "Trạng thái", value: "Hoàn thành" },
          {
            label: "Kết quả sửa chữa",
            value: "thay pin cmos. Máy hoạt động được . Đang theo dõi.",
          },
        ],
      },
      {
        id: "27",
        occurredAt: "2026-03-21T08:36:39.517454Z",
        actionLabel: "Phê duyệt sửa chữa",
        actorName: "Nguyễn Ngọc Du",
        details: [
          { label: "Người duyệt", value: "Nguyễn Ngọc Du" },
          { label: "Trạng thái", value: "Đã duyệt" },
        ],
      },
      {
        id: "26",
        occurredAt: "2026-03-21T08:36:34.593532Z",
        actionLabel: "Tạo yêu cầu sửa chữa",
        actorName: "Nguyễn Ngọc Du",
        details: [
          { label: "Trạng thái", value: "Chờ xử lý" },
          { label: "Người yêu cầu", value: "Nguyễn Ngọc Du" },
        ],
      },
    ])
  })
})
