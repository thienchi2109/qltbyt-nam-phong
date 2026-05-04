import * as React from "react"
import { act, render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        role: "to_qltb",
        username: "tech",
        full_name: "Tech User",
      },
    },
  }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock("@/lib/rbac", () => ({
  isEquipmentManagerRole: () => true,
  isRegionalLeaderRole: () => false,
}))

vi.mock("../_hooks/useAssistantDraft", () => ({
  useAssistantDraft: () => ({
    assistantDraft: null,
    draftEquipment: null,
    applyAssistantDraft: vi.fn(),
    clearAssistantDraft: vi.fn(),
  }),
}))

import { RepairRequestsContext, RepairRequestsProvider } from "../_components/RepairRequestsContext"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function MutationHarness() {
  return (
    <MutationHarnessWithPayload
      payload={{
        id: 99,
        completion: "Đã sửa xong",
        reason: null,
        repairCost: 1234567,
      }}
    />
  )
}

function MutationHarnessWithPayload({
  payload,
}: {
  payload: {
    id: number
    completion: string | null
    reason: string | null
    repairCost: number | null
  }
}) {
  const context = React.useContext(RepairRequestsContext)
  const hasTriggeredRef = React.useRef(false)

  React.useEffect(() => {
    if (!context || hasTriggeredRef.current) {
      return
    }

    hasTriggeredRef.current = true

    context.completeMutation.mutate(payload)
  }, [context, payload])

  return null
}

describe("RepairRequestsContext complete mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockResolvedValue(undefined)
  })

  it("passes p_chi_phi_sua_chua to repair_request_complete", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })

    render(
      <RepairRequestsProvider>
        <MutationHarness />
      </RepairRequestsProvider>,
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "repair_request_complete",
        args: {
          p_id: 99,
          p_completion: "Đã sửa xong",
          p_reason: null,
          p_chi_phi_sua_chua: 1234567,
        },
      })
    })
  })

  it("invalidates the overdue summary query after a successful complete mutation", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    render(
      <RepairRequestsProvider>
        <MutationHarness />
      </RepairRequestsProvider>,
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "repair_request_complete",
        args: {
          p_id: 99,
          p_completion: "Đã sửa xong",
          p_reason: null,
          p_chi_phi_sua_chua: 1234567,
        },
      })
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["repair_request_overdue_summary"],
      })
    })
  })

  it("rejects blank completion before calling RPC", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })

    render(
      <RepairRequestsProvider>
        <MutationHarnessWithPayload
          payload={{
            id: 99,
            completion: "   ",
            reason: null,
            repairCost: null,
          }}
        />
      </RepairRequestsProvider>,
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(mockCallRpc).not.toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi cập nhật yêu cầu",
          description: "Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành",
        })
      )
    })
  })
})
