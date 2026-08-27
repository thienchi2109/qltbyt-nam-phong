import "@testing-library/jest-dom"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { UserSummary } from "@/types/database"
import {
  expertUserManagementTenants,
  makeExpertManagementUser,
  renderWithQueryClient,
} from "./expert-user-management.test-harness"
import { AddUserDialog } from "../add-user-dialog"
import { EditUserDialog } from "../edit-user-dialog"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  fetchTenantList: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mocks.callRpc(...args),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("../add-equipment-dialog.queries", () => ({
  fetchTenantList: () => mocks.fetchTenantList(),
}))

vi.mock("@/components/ui/dialog", async () => {
  const { dialogMocks } = await import("./expert-user-management.test-harness")
  return dialogMocks
})

vi.mock("@/components/ui/select", async () => {
  const { selectMocks } = await import("./expert-user-management.test-harness")
  return selectMocks
})

vi.mock("@/components/ui/scroll-area", async () => {
  const { scrollAreaMocks } = await import("./expert-user-management.test-harness")
  return scrollAreaMocks
})

function renderAddDialog(operatorRole: string) {
  return renderWithQueryClient(
    <AddUserDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} operatorRole={operatorRole} />
  )
}

function renderEditDialog(user: UserSummary, operatorRole: string) {
  return renderWithQueryClient(
    <EditUserDialog
      open
      onOpenChange={vi.fn()}
      onSuccess={vi.fn()}
      operatorRole={operatorRole}
      user={user}
    />
  )
}

describe("expert user-management activation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchTenantList.mockResolvedValue(expertUserManagementTenants)
  })

  it("creates an expert with one required current unit and no extra memberships", async () => {
    mocks.callRpc.mockResolvedValueOnce(91)
    renderAddDialog("global")

    fireEvent.change(screen.getByLabelText("Tên đăng nhập *"), {
      target: { value: "expert-a" },
    })
    fireEvent.change(screen.getByLabelText("Mật khẩu *"), {
      target: { value: "secret-123" },
    })
    fireEvent.change(screen.getByLabelText("Họ và tên *"), {
      target: { value: "Chuyên gia A" },
    })

    const selects = await screen.findAllByRole("combobox")
    fireEvent.change(selects[0], { target: { value: "chuyen_gia" } })
    fireEvent.change(selects[1], { target: { value: "12" } })
    expect(screen.queryByText("Thành viên đơn vị (tùy chọn)")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }))

    await waitFor(() =>
      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "user_create",
        args: {
          p_username: "expert-a",
          p_password: "secret-123",
          p_full_name: "Chuyên gia A",
          p_role: "chuyen_gia",
          p_current_don_vi: 12,
          p_memberships: null,
        },
      })
    )
  })

  it("blocks expert creation before submitting when the current unit is missing", async () => {
    renderAddDialog("admin")

    fireEvent.change(screen.getByLabelText("Tên đăng nhập *"), {
      target: { value: "expert-b" },
    })
    fireEvent.change(screen.getByLabelText("Mật khẩu *"), {
      target: { value: "secret-123" },
    })
    fireEvent.change(screen.getByLabelText("Họ và tên *"), {
      target: { value: "Chuyên gia B" },
    })
    fireEvent.change((await screen.findAllByRole("combobox"))[0], {
      target: { value: "chuyen_gia" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: expect.stringContaining("Đơn vị hiện tại"),
      })
    )
  })

  it("updates an expert and reassigns scope only through the dedicated RPC", async () => {
    mocks.callRpc.mockResolvedValueOnce(undefined)
    const user = makeExpertManagementUser({ role: "chuyen_gia" }) as UserSummary & {
      current_don_vi: number
    }
    user.current_don_vi = 11

    renderEditDialog(user, "admin")

    await screen.findByRole("option", { name: "Bệnh viện B (BV-B)" })
    const selects = screen.getAllByRole("combobox")
    fireEvent.change(selects[1], { target: { value: "12" } })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "user_reassign_expert_scope",
      args: {
        p_user_id: 7,
        p_don_vi: 12,
      },
    })
    expect(
      mocks.callRpc.mock.calls.some(([request]) =>
        ["user_membership_add", "user_membership_remove", "user_set_current_don_vi"].includes(
          request.fn
        )
      )
    ).toBe(false)
  })

  it("blocks changing expert profile fields and scope in the same submit", async () => {
    const user = makeExpertManagementUser({ role: "chuyen_gia" }) as UserSummary & {
      current_don_vi: number
    }
    user.current_don_vi = 11

    renderEditDialog(user, "global")

    fireEvent.change(screen.getByLabelText("Họ và tên *"), {
      target: { value: "Chuyên gia đổi tên" },
    })
    await screen.findByRole("option", { name: "Bệnh viện B (BV-B)" })
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "12" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: expect.stringContaining("từng bước"),
      })
    )
  })

  it("blocks selecting a different unit in the same submit that promotes an expert", async () => {
    const user = makeExpertManagementUser() as UserSummary & {
      current_don_vi: number
    }
    user.current_don_vi = 11

    renderEditDialog(user, "admin")

    fireEvent.change((await screen.findAllByRole("combobox"))[0], {
      target: { value: "chuyen_gia" },
    })
    await screen.findByRole("option", { name: "Bệnh viện B (BV-B)" })
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "12" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: expect.stringContaining("đơn vị hiện tại"),
      })
    )
  })

  it("promotes an expert atomically on the account's existing unit", async () => {
    mocks.callRpc.mockResolvedValueOnce(true)
    const user = makeExpertManagementUser() as UserSummary & {
      current_don_vi: number
    }
    user.current_don_vi = 11

    renderEditDialog(user, "global")

    fireEvent.change((await screen.findAllByRole("combobox"))[0], {
      target: { value: "chuyen_gia" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "user_update_profile",
      args: {
        p_target_user_id: 7,
        p_username: "nva",
        p_full_name: "Nguyen Van A",
        p_role: "chuyen_gia",
        p_khoa_phong: "Khoa A",
      },
    })
  })

  it("surfaces reassignment failure without falling back to generic scope RPCs", async () => {
    mocks.callRpc.mockRejectedValueOnce(new Error("Không thể đổi đơn vị"))
    const user = makeExpertManagementUser({ role: "chuyen_gia" }) as UserSummary & {
      current_don_vi: number
    }
    user.current_don_vi = 11

    renderEditDialog(user, "admin")

    await screen.findByRole("option", { name: "Bệnh viện B (BV-B)" })
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "12" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Không thể đổi đơn vị",
        })
      )
    )
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "user_reassign_expert_scope",
      args: {
        p_user_id: 7,
        p_don_vi: 12,
      },
    })
  })

  it("updates an expert profile without rewriting unchanged scope", async () => {
    mocks.callRpc.mockResolvedValueOnce(true)
    const user = makeExpertManagementUser({ role: "chuyen_gia" }) as UserSummary & {
      current_don_vi: number
    }
    user.current_don_vi = 11

    renderEditDialog(user, "global")

    fireEvent.change(screen.getByLabelText("Họ và tên *"), {
      target: { value: "Chuyên gia cập nhật" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "user_update_profile",
      args: {
        p_target_user_id: 7,
        p_username: "nva",
        p_full_name: "Chuyên gia cập nhật",
        p_role: "chuyen_gia",
        p_khoa_phong: "Khoa A",
      },
    })
  })

  it("blocks an expert role change before submitting when no unit is selected", async () => {
    renderEditDialog(makeExpertManagementUser(), "global")

    fireEvent.change((await screen.findAllByRole("combobox"))[0], {
      target: { value: "chuyen_gia" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: expect.stringContaining("Đơn vị"),
      })
    )
  })
})
