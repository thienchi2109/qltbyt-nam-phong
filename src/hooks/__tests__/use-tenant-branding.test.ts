import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
  useSession: vi.fn(),
  callRpc: vi.fn(),
}))

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")
  return {
    ...actual,
    useQuery: mocks.useQuery,
    useQueryClient: mocks.useQueryClient,
  }
})

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mocks.callRpc(...args),
}))

import { useTenantBranding } from "@/hooks/use-tenant-branding"

describe("useTenantBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockImplementation((options: unknown) => options)
    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "global", don_vi: null } },
      status: "authenticated",
    })
  })

  it("keeps branding bootstrap disabled while the session is loading", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "global", don_vi: null } },
      status: "loading",
    })

    renderHook(() => useTenantBranding())

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["tenant_branding", { tenant: "none" }],
        enabled: false,
      })
    )
  })

  it("enables branding fetch once the authenticated session is ready", async () => {
    mocks.callRpc.mockResolvedValueOnce([{ id: 7, name: "CDC", logo_url: null }])

    renderHook(() => useTenantBranding())

    const firstCall = mocks.useQuery.mock.calls[0]?.[0]
    expect(firstCall).toBeDefined()
    expect(firstCall.enabled).toBe(true)

    await expect(firstCall.queryFn({ signal: undefined })).resolves.toEqual({
      id: 7,
      name: "CDC",
      logo_url: null,
    })

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "don_vi_branding_get",
      args: { p_id: null },
      signal: undefined,
    })
  })
})
