import { describe, expect, it } from "vitest"

import { mapTransferHistoryEntries } from "../transfer-detail-history-adapter"
import type { TransferChangeHistory } from "@/types/database"

describe("mapTransferHistoryEntries", () => {
  it("maps transfer history rows into the shared change history contract", () => {
    const entries: TransferChangeHistory[] = [
      {
        id: 2,
        action_type: "transfer_request_update",
        admin_username: "nva",
        admin_full_name: "Nguyễn Văn A",
        action_details: {
          ma_yeu_cau: "LC-0011",
          trang_thai: "da_duyet",
          loai_hinh: "noi_bo",
          thiet_bi_id: 101,
        },
        created_at: "2026-04-02T00:00:00.000Z",
      },
    ]

    expect(mapTransferHistoryEntries(entries)).toEqual([
      {
        id: "2",
        occurredAt: "2026-04-02T00:00:00.000Z",
        actionLabel: "Cập nhật yêu cầu luân chuyển",
        actorName: "Nguyễn Văn A",
        details: [
          { label: "Mã yêu cầu", value: "LC-0011" },
          { label: "Trạng thái", value: "Đã duyệt" },
        ],
      },
    ])
  })

  it("maps transfer audit status and completion actions", () => {
    const entries: TransferChangeHistory[] = [
      {
        id: 3,
        action_type: "transfer_request_update_status",
        admin_username: "nva",
        admin_full_name: "Nguyễn Văn A",
        action_details: {
          trang_thai: "da_duyet",
          ngay_duyet: "2026-04-03T01:02:03.000Z",
        },
        created_at: "2026-04-03T00:00:00.000Z",
      },
      {
        id: 4,
        action_type: "transfer_request_complete",
        admin_username: "ttb",
        admin_full_name: "Trần Thị B",
        action_details: {
          trang_thai: "hoan_thanh",
          ngay_hoan_thanh: "2026-04-04T05:06:07.000Z",
        },
        created_at: "2026-04-04T00:00:00.000Z",
      },
    ]

    expect(mapTransferHistoryEntries(entries)).toEqual([
      {
        id: "3",
        occurredAt: "2026-04-03T00:00:00.000Z",
        actionLabel: "Cập nhật trạng thái yêu cầu luân chuyển",
        actorName: "Nguyễn Văn A",
        details: [
          { label: "Trạng thái", value: "Đã duyệt" },
          { label: "Ngày duyệt", value: "2026-04-03T01:02:03.000Z" },
        ],
      },
      {
        id: "4",
        occurredAt: "2026-04-04T00:00:00.000Z",
        actionLabel: "Hoàn thành luân chuyển",
        actorName: "Trần Thị B",
        details: [
          { label: "Trạng thái", value: "Hoàn thành" },
          { label: "Ngày hoàn thành", value: "2026-04-04T05:06:07.000Z" },
        ],
      },
    ])
  })
})
