import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SessionUser, UserSummary } from "@/types/database"

import { useUsersManagement } from "../_hooks/useUsersManagement"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mocks.callRpc(...args),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

const adminUser: SessionUser = {
  id: 1,
  role: "global",
  khoa_phong: null,
  username: "admin",
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function makeUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: overrides.id ?? 2,
    username: overrides.username ?? "user-2",
    full_name: overrides.full_name ?? "Người dùng 2",
    role: overrides.role ?? "qltb_khoa",
    khoa_phong: overrides.khoa_phong ?? "Khoa A",
    created_at: overrides.created_at ?? "2026-05-01T00:00:00.000Z",
  }
}

describe("useUsersManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches users through the admin list RPC when enabled", async () => {
    const users = [makeUser()]
    mocks.callRpc.mockResolvedValueOnce(users)

    const { result } = renderHook(() =>
      useUsersManagement({ user: adminUser, enabled: true }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mocks.callRpc).toHaveBeenCalledWith({ fn: "user_list_for_admin" })
    expect(result.current.users).toEqual(users)
  })

  it("does not fetch users when disabled", () => {
    renderHook(() => useUsersManagement({ user: adminUser, enabled: false }), {
      wrapper: createWrapper(),
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("blocks deleting the current user before calling RPC", async () => {
    const { result } = renderHook(() =>
      useUsersManagement({ user: adminUser, enabled: false }),
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.setUserToDelete(makeUser({ id: 1 }))
    })

    await act(async () => {
      await result.current.handleDeleteUser()
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Bạn không thể xóa tài khoản của chính mình.",
      }),
    )
  })

  it("deletes another user through user_delete_by_admin", async () => {
    mocks.callRpc.mockResolvedValueOnce(true)
    const { result } = renderHook(() =>
      useUsersManagement({ user: adminUser, enabled: false }),
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.setUserToDelete(makeUser({ id: 3 }))
    })

    await act(async () => {
      await result.current.handleDeleteUser()
    })

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "user_delete_by_admin",
      args: { p_target_user_id: 3 },
    })
  })

  it("does not report success when user_delete_by_admin returns false", async () => {
    mocks.callRpc.mockResolvedValueOnce(false)
    const { result } = renderHook(() =>
      useUsersManagement({ user: adminUser, enabled: false }),
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.setUserToDelete(makeUser({ id: 3 }))
    })

    await act(async () => {
      await result.current.handleDeleteUser()
    })

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Lỗi xóa người dùng",
      }),
    )
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Đã xóa",
      }),
    )
  })

  it("surfaces reset-password RPC failure messages", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      success: false,
      message: "Không thể đặt lại mật khẩu",
    })
    const { result } = renderHook(() =>
      useUsersManagement({ user: adminUser, enabled: false }),
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.setUserToReset(makeUser({ id: 4 }))
    })

    await act(async () => {
      await result.current.handleResetPassword()
    })

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "reset_password_by_admin",
      args: {
        p_admin_user_id: 1,
        p_target_user_id: 4,
      },
    })
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Lỗi đặt lại mật khẩu",
      }),
    )
  })
})
