import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { updateEquipmentRecord } from "../edit-equipment-dialog.rpc"

describe("updateEquipmentRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("submits the patch and ignores the boolean RPC payload", async () => {
    mocks.callRpc.mockResolvedValueOnce(true)

    await expect(
      updateEquipmentRecord(15, {
        ten_thiet_bi: "Máy siêu âm A",
        tinh_trang_hien_tai: "Hoạt động",
      }),
    ).resolves.toBeUndefined()

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "equipment_update",
      args: {
        p_id: 15,
        p_patch: {
          ten_thiet_bi: "Máy siêu âm A",
          tinh_trang_hien_tai: "Hoạt động",
        },
      },
    })
  })
})
