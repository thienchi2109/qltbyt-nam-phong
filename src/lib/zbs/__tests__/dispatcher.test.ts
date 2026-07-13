import { describe, expect, it } from "vitest"

import {
  type ReadPendingZbsOutboxRowsOptions,
  ZALO_ZBS_ACCESS_TOKEN_HEADER_PLACEHOLDER,
  ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT,
  ZBS_PENDING_DISPATCH_RPC,
  ZBS_REPAIR_ISSUE_SUMMARY,
  buildZbsDryRunDispatches,
  buildZbsTemplateRequest,
  mapRepairRequestTemplateData,
  normalizeZbsPhoneNumber,
  readPendingZbsOutboxRows,
} from "../dispatcher"

type TestRpcClient = NonNullable<ReadPendingZbsOutboxRowsOptions["rpcClient"]>
type TestRpcRows = Awaited<ReturnType<TestRpcClient>>

const baseOutboxRow = {
  id: "outbox-1",
  event_type: "repair_request_created",
  source_type: "repair_request",
  source_id: 42,
  don_vi_id: 7,
  recipient_config_id: "recipient-1",
  recipient_phone: "84987654321",
  template_id: "template-123",
  tracking_id: "repair_request:42:recipient-1",
  status: "pending",
  provider: "zalo_zbs",
  next_attempt_at: "2026-06-30T00:00:00.000Z",
  template_data: {
    repair_request_id: 42,
    equipment_code: "TB-001",
    equipment_name: "May tho ICU",
    department: "ICU",
    issue_description: "Khong khoi dong duoc",
    requester: "Nguyen Van A",
  },
} as const

describe("normalizeZbsPhoneNumber", () => {
  it("normalizes Vietnam phone numbers into country-code digits", () => {
    expect(normalizeZbsPhoneNumber("+84 987 654 321")).toBe("84987654321")
    expect(normalizeZbsPhoneNumber("0987-654-321")).toBe("84987654321")
  })

  it("rejects phones outside the ZBS country-code contract", () => {
    expect(() => normalizeZbsPhoneNumber("12345")).toThrow("Invalid ZBS recipient phone")
    expect(() => normalizeZbsPhoneNumber("84987654abc")).toThrow("Invalid ZBS recipient phone")
    expect(() => normalizeZbsPhoneNumber("8498765432")).toThrow("Invalid ZBS recipient phone")
    expect(() => normalizeZbsPhoneNumber("849876543210")).toThrow("Invalid ZBS recipient phone")
  })
})

describe("mapRepairRequestTemplateData", () => {
  it("maps internal outbox repair context into the approved ZBS template fields", () => {
    expect(
      mapRepairRequestTemplateData(baseOutboxRow, {
        appBaseUrl: "https://app.example.test",
      })
    ).toEqual({
      request_id: "42",
      equipment: "May tho ICU (TB-001)",
      department: "ICU",
      requester: "Nguyen Van A",
      issue_summary: ZBS_REPAIR_ISSUE_SUMMARY,
      detail_url: "https://app.example.test/repair-requests?action=view&requestId=42",
    })
  })

  it("uses a fixed provider-safe issue summary instead of long user-entered details", () => {
    const longIssueDescription = [
      "Máy thở báo lỗi áp lực đường thở liên tục, màn hình hiển thị cảnh báo kéo dài.",
      "Khoa đã thử khởi động lại nhiều lần nhưng thiết bị vẫn không hoạt động ổn định.",
      "Cần kiểm tra gấp vì nội dung này dài hơn giới hạn trường Zalo template.",
    ].join(" ")

    const templateData = mapRepairRequestTemplateData({
      ...baseOutboxRow,
      template_data: {
        ...baseOutboxRow.template_data,
        issue_description: longIssueDescription,
      },
    })

    expect(templateData.issue_summary).toBe(ZBS_REPAIR_ISSUE_SUMMARY)
    expect(templateData.issue_summary).not.toContain("Máy thở báo lỗi")
    expect(new TextEncoder().encode(templateData.issue_summary).length).toBeLessThanOrEqual(32)
  })

  it("normalizes and truncates requester to the provider character limit", () => {
    const templateData = mapRepairRequestTemplateData({
      ...baseOutboxRow,
      template_data: {
        ...baseOutboxRow.template_data,
        requester: "Khoa Hồi Sức Tích Cực - Chống Độc",
      },
    })

    expect(templateData.requester).toBe("Khoa Hồi Sức Tích Cực - Chố...")
    expect([...templateData.requester]).toHaveLength(30)
  })

  it.each([
    {
      name: "keeps an exact 30-character requester unchanged",
      requester: "Đ".repeat(30),
      expected: "Đ".repeat(30),
    },
    {
      name: "normalizes a short requester to NFC",
      requester: "  Khoa Hồi Sức  ",
      expected: "Khoa Hồi Sức",
    },
    {
      name: "does not split a four-byte Unicode code point",
      requester: "12345678901234567890123456😀abcdef",
      expected: "12345678901234567890123456😀...",
    },
  ])("$name", ({ requester, expected }) => {
    const templateData = mapRepairRequestTemplateData({
      ...baseOutboxRow,
      template_data: {
        ...baseOutboxRow.template_data,
        requester,
      },
    })

    expect(templateData.requester).toBe(expected)
    expect([...templateData.requester].length).toBeLessThanOrEqual(30)
  })

  it("uses documented fallbacks and fixed issue_summary before request construction", () => {
    const longIssueSummary = "Loi ".repeat(80)

    const templateData = mapRepairRequestTemplateData({
      ...baseOutboxRow,
      source_id: 99,
      template_data: {
        repair_request_id: 99,
        equipment_code: "",
        equipment_name: "",
        department: "",
        issue_description: longIssueSummary,
        requester: "",
      },
    })

    expect(templateData).toMatchObject({
      request_id: "99",
      equipment: "Khong ro",
      department: "Khong ro",
      requester: "Khong ro",
      detail_url: "/repair-requests?action=view&requestId=99",
    })
    expect(templateData.issue_summary).toBe(ZBS_REPAIR_ISSUE_SUMMARY)
  })
})

describe("buildZbsTemplateRequest", () => {
  it("constructs the approved ZBS phone API request without exposing real secrets", () => {
    expect(
      buildZbsTemplateRequest(baseOutboxRow, {
        appBaseUrl: "https://app.example.test/",
      })
    ).toEqual({
      endpoint: ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT,
      method: "POST",
      headers: {
        access_token: ZALO_ZBS_ACCESS_TOKEN_HEADER_PLACEHOLDER,
      },
      body: {
        phone: "84987654321",
        template_id: "template-123",
        template_data: {
          request_id: "42",
          equipment: "May tho ICU (TB-001)",
          department: "ICU",
          requester: "Nguyen Van A",
          issue_summary: ZBS_REPAIR_ISSUE_SUMMARY,
          detail_url: "https://app.example.test/repair-requests?action=view&requestId=42",
        },
        tracking_id: "repair_request:42:recipient-1",
      },
    })
  })
})

describe("buildZbsDryRunDispatches", () => {
  it("builds inspectable disabled-dispatch requests only for pending repair notifications", () => {
    const dispatches = buildZbsDryRunDispatches(
      [
        baseOutboxRow,
        {
          ...baseOutboxRow,
          id: "sent-1",
          status: "sent",
          tracking_id: "repair_request:42:sent-1",
        },
        {
          ...baseOutboxRow,
          id: "transfer-1",
          event_type: "transfer_request_created",
          source_type: "transfer_request",
          tracking_id: "transfer_request:42:recipient-1",
        },
      ],
      { dispatchEnabled: false }
    )

    expect(dispatches).toHaveLength(1)
    expect(dispatches[0]).toMatchObject({
      outbox_id: "outbox-1",
      dispatch_state: "disabled-dispatch",
      would_send_live_request: false,
      reason: "ZALO_ZBS_DISPATCH_ENABLED is not true",
    })
    expect(dispatches[0]?.dispatch_state).toBe("disabled-dispatch")
    if (dispatches[0]?.dispatch_state !== "build-error") {
      expect(dispatches[0]?.request.body.tracking_id).toBe("repair_request:42:recipient-1")
    }
  })

  it("captures per-row request build failures without aborting the dry-run batch", () => {
    const dispatches = buildZbsDryRunDispatches([
      {
        ...baseOutboxRow,
        id: "invalid-phone",
        recipient_phone: "not-a-phone",
      },
      {
        ...baseOutboxRow,
        id: "valid-phone",
        recipient_phone: "0987654321",
        tracking_id: "repair_request:42:valid-phone",
      },
    ])

    expect(dispatches).toHaveLength(2)
    expect(dispatches[0]).toEqual({
      outbox_id: "invalid-phone",
      dispatch_state: "build-error",
      would_send_live_request: false,
      reason: "Failed to build ZBS request",
      error: {
        message: "Invalid ZBS recipient phone",
      },
    })
    expect(dispatches[1]?.dispatch_state).toBe("disabled-dispatch")
    if (dispatches[1]?.dispatch_state !== "build-error") {
      expect(dispatches[1]?.request.body).toMatchObject({
        phone: "84987654321",
        tracking_id: "repair_request:42:valid-phone",
      })
    }
  })
})

describe("readPendingZbsOutboxRows", () => {
  it("reads pending repair_request_created rows through the RPC proxy contract", async () => {
    const row = { ...baseOutboxRow }
    const calls: unknown[] = []
    const rpcClient = async (options: unknown) => {
      calls.push(options)
      return [row]
    }

    await expect(
      readPendingZbsOutboxRows({
        now: new Date("2026-06-30T07:30:00.000Z"),
        limit: 10,
        rpcClient,
      })
    ).resolves.toEqual([row])
    expect(calls).toEqual([
      {
        fn: ZBS_PENDING_DISPATCH_RPC,
        args: {
          p_limit: 10,
          p_now: "2026-06-30T07:30:00.000Z",
        },
      },
    ])
  })

  it("surfaces RPC read failures without attempting dispatch", async () => {
    const rpcClient = async () => {
      throw new Error("permission denied")
    }

    await expect(readPendingZbsOutboxRows({ rpcClient })).rejects.toThrow(
      "Failed to read pending ZBS outbox rows: permission denied"
    )
  })

  it("preserves the array contract for malformed RPC responses", async () => {
    const nullRpcClient: TestRpcClient = async () => null as unknown as TestRpcRows
    const objectRpcClient: TestRpcClient = async () =>
      ({ rows: [baseOutboxRow] }) as unknown as TestRpcRows

    await expect(readPendingZbsOutboxRows({ rpcClient: nullRpcClient })).resolves.toEqual([])
    await expect(readPendingZbsOutboxRows({ rpcClient: objectRpcClient })).resolves.toEqual([])
  })
})
