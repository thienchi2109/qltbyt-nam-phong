import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EQUIPMENT_ATTENTION_ACTION } from "@/lib/equipment-attention-preset"
import type { Equipment } from "@/app/(app)/equipment/types"
import { useEquipmentRouteSync } from "../_hooks/useEquipmentRouteSync"

const nav = vi.hoisted(() => ({
  pathname: "/equipment",
  searchParams: new URLSearchParams(),
  replace: vi.fn((url: string) => {
    const nextUrl = new URL(url, "https://example.test")
    nav.pathname = nextUrl.pathname
    nav.searchParams = new URLSearchParams(nextUrl.search)
  }),
  push: vi.fn(),
}))

const mockCallRpc = vi.hoisted(() => vi.fn())
const mockToast = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
  }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.searchParams,
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mockCallRpc,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

describe("useEquipmentRouteSync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.pathname = "/equipment"
    nav.searchParams = new URLSearchParams()

    if (!globalThis.CSS) {
      ;(globalThis as { CSS: { escape: (value: string) => string } }).CSS = {
        escape: (value: string) => value,
      }
    } else if (!globalThis.CSS.escape) {
      globalThis.CSS.escape = (value: string) => value
    }

    vi.spyOn(document, "querySelector").mockReturnValue(null)
  })

  it("creates pending preset action and cleans transient params for attention-status", async () => {
    nav.searchParams = new URLSearchParams(`action=${EQUIPMENT_ATTENTION_ACTION}&page=2&q=abc`)

    const { result } = renderHook(() => useEquipmentRouteSync({ data: [], isDataReady: true }))

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({ type: "applyAttentionStatusPreset" })
    })

    expect(nav.replace).toHaveBeenCalledWith("/equipment?page=2&q=abc", { scroll: false })
  })

  it("keeps existing add action behavior", async () => {
    nav.searchParams = new URLSearchParams("action=add&tab=list")

    const { result } = renderHook(() => useEquipmentRouteSync({ data: [], isDataReady: true }))

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({ type: "openAdd" })
    })

    expect(nav.replace).toHaveBeenCalledWith("/equipment?tab=list", { scroll: false })
  })

  it("hydrates search and facility query params for equipment deep-links", async () => {
    const hydrateSearch = vi.fn()
    const hydrateFacility = vi.fn()
    nav.searchParams = new URLSearchParams("search=monitor&facility=101")

    renderHook(() =>
      useEquipmentRouteSync({
        data: [],
        isDataReady: true,
        onSearchParamHydrated: hydrateSearch,
        onFacilityParamHydrated: hydrateFacility,
      })
    )

    await waitFor(() => {
      expect(hydrateSearch).toHaveBeenCalledWith("monitor")
      expect(hydrateFacility).toHaveBeenCalledWith(101)
    })
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("hydrates region query params to all-facility scope without overriding search", async () => {
    const hydrateSearch = vi.fn()
    const hydrateFacility = vi.fn()
    nav.searchParams = new URLSearchParams("search=máy thở&region=10")

    renderHook(() =>
      useEquipmentRouteSync({
        data: [],
        isDataReady: true,
        onSearchParamHydrated: hydrateSearch,
        onFacilityParamHydrated: hydrateFacility,
      })
    )

    await waitFor(() => {
      expect(hydrateSearch).toHaveBeenCalledWith("máy thở")
      expect(hydrateFacility).toHaveBeenCalledWith(null)
    })
  })

  it("does not rehydrate facility params after a local facility selection change", async () => {
    const hydrateSearch = vi.fn()
    const hydrateFacility = vi.fn()
    nav.searchParams = new URLSearchParams("search=monitor&facility=101")

    const { rerender } = renderHook(
      ({ selectedFacilityId }: { selectedFacilityId: number | null | undefined }) =>
        useEquipmentRouteSync({
          data: [],
          isDataReady: true,
          onSearchParamHydrated: hydrateSearch,
          onFacilityParamHydrated: hydrateFacility,
          selectedFacilityId,
        }),
      { initialProps: { selectedFacilityId: undefined } }
    )

    await waitFor(() => {
      expect(hydrateFacility).toHaveBeenCalledWith(101)
    })
    expect(hydrateSearch).not.toHaveBeenCalled()

    hydrateFacility.mockClear()

    rerender({ selectedFacilityId: 101 })

    await waitFor(() => {
      expect(hydrateSearch).toHaveBeenCalledWith("monitor")
    })
    expect(hydrateFacility).not.toHaveBeenCalled()

    hydrateSearch.mockClear()

    rerender({ selectedFacilityId: 202 })

    expect(hydrateSearch).not.toHaveBeenCalled()
    expect(hydrateFacility).not.toHaveBeenCalled()
  })

  it("keeps highlight action behavior and preserves non-transient params", async () => {
    const equipment = { id: 123, ten_thiet_bi: "X-quang" } as Equipment
    nav.searchParams = new URLSearchParams("highlight=123&view=card&page=4")

    const { result } = renderHook(() =>
      useEquipmentRouteSync({ data: [equipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(result.current.pendingAction?.type).toBe("openDetail")
    })

    expect(result.current.pendingAction).toEqual({
      type: "openDetail",
      equipment,
      highlightId: 123,
    })
    expect(nav.replace).toHaveBeenCalledWith("/equipment?view=card&page=4", { scroll: false })
  })

  // --- Issue #209: RPC Fallback Tests ---

  it("fetches equipment via RPC when highlight target is not in data slice", async () => {
    const fetchedEquipment = { id: 42, ten_thiet_bi: "CT Scanner" }
    mockCallRpc.mockResolvedValueOnce(fetchedEquipment)

    // data has items but NOT the highlighted one
    const otherEquipment = { id: 999, ten_thiet_bi: "MRI" } as Equipment
    nav.searchParams = new URLSearchParams("highlight=42")

    const { result } = renderHook(() =>
      useEquipmentRouteSync({ data: [otherEquipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(result.current.pendingAction?.type).toBe("openDetail")
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "equipment_get",
      args: { p_id: 42 },
    })
    expect(result.current.pendingAction).toEqual({
      type: "openDetail",
      equipment: fetchedEquipment,
      highlightId: 42,
    })
    expect(nav.replace).toHaveBeenCalledWith("/equipment", { scroll: false })
  })

  it("fetches equipment via RPC when the settled data slice is empty", async () => {
    const fetchedEquipment = { id: 42, ten_thiet_bi: "CT Scanner" }
    mockCallRpc.mockResolvedValueOnce(fetchedEquipment)
    nav.searchParams = new URLSearchParams("highlight=42")

    const { result } = renderHook(() => useEquipmentRouteSync({ data: [], isDataReady: true }))

    await waitFor(() => {
      expect(result.current.pendingAction?.type).toBe("openDetail")
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "equipment_get",
      args: { p_id: 42 },
    })
    expect(result.current.pendingAction).toEqual({
      type: "openDetail",
      equipment: fetchedEquipment,
      highlightId: 42,
    })
    expect(nav.replace).toHaveBeenCalledWith("/equipment", { scroll: false })
  })

  it("shows toast when RPC fallback also fails to find equipment", async () => {
    mockCallRpc.mockResolvedValueOnce(null)

    const otherEquipment = { id: 999, ten_thiet_bi: "MRI" } as Equipment
    nav.searchParams = new URLSearchParams("highlight=42")

    const { result } = renderHook(() =>
      useEquipmentRouteSync({ data: [otherEquipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled()
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
      })
    )
    expect(result.current.pendingAction).toBeNull()
    expect(nav.replace).toHaveBeenCalledWith("/equipment", { scroll: false })
  })

  it("clears a stale pending action when RPC fallback returns not found", async () => {
    const previousEquipment = { id: 7, ten_thiet_bi: "X-quang" } as Equipment

    nav.searchParams = new URLSearchParams("highlight=7")
    const { result, rerender } = renderHook(() =>
      useEquipmentRouteSync({ data: [previousEquipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({
        type: "openDetail",
        equipment: previousEquipment,
        highlightId: 7,
      })
    })

    mockCallRpc.mockResolvedValueOnce(null)
    nav.searchParams = new URLSearchParams("highlight=42")
    rerender()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled()
      expect(result.current.pendingAction).toBeNull()
    })
  })

  it("clears a stale pending action when RPC fallback throws", async () => {
    const previousEquipment = { id: 7, ten_thiet_bi: "X-quang" } as Equipment

    nav.searchParams = new URLSearchParams("highlight=7")
    const { result, rerender } = renderHook(() =>
      useEquipmentRouteSync({ data: [previousEquipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({
        type: "openDetail",
        equipment: previousEquipment,
        highlightId: 7,
      })
    })

    mockCallRpc.mockRejectedValueOnce(new Error("boom"))
    nav.searchParams = new URLSearchParams("highlight=42")
    rerender()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled()
      expect(result.current.pendingAction).toBeNull()
    })
  })

  it("does not call RPC when equipment IS in data slice", async () => {
    const equipment = { id: 42, ten_thiet_bi: "CT Scanner" } as Equipment
    nav.searchParams = new URLSearchParams("highlight=42")

    const { result } = renderHook(() =>
      useEquipmentRouteSync({ data: [equipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(result.current.pendingAction?.type).toBe("openDetail")
    })

    expect(mockCallRpc).not.toHaveBeenCalled()
    expect(result.current.pendingAction).toEqual({
      type: "openDetail",
      equipment,
      highlightId: 42,
    })
  })

  it("exposes isFetchingHighlight during RPC fallback call", async () => {
    let resolveRpc: (value: unknown) => void
    mockCallRpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const otherEquipment = { id: 999, ten_thiet_bi: "MRI" } as Equipment
    nav.searchParams = new URLSearchParams("highlight=42")

    const { result } = renderHook(() =>
      useEquipmentRouteSync({ data: [otherEquipment], isDataReady: true })
    )

    // Should be fetching
    await waitFor(() => {
      expect(result.current.isFetchingHighlight).toBe(true)
    })

    // Resolve the RPC
    resolveRpc!({ id: 42, ten_thiet_bi: "CT Scanner" })

    // Should stop fetching
    await waitFor(() => {
      expect(result.current.isFetchingHighlight).toBe(false)
    })

    expect(result.current.pendingAction?.type).toBe("openDetail")
  })

  it("cancels stale highlight fallback when the user navigates to add action", async () => {
    let resolveRpc: (value: unknown) => void
    mockCallRpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const otherEquipment = { id: 999, ten_thiet_bi: "MRI" } as Equipment
    nav.searchParams = new URLSearchParams("highlight=42")

    const { result, rerender } = renderHook(() =>
      useEquipmentRouteSync({ data: [otherEquipment], isDataReady: true })
    )

    await waitFor(() => {
      expect(result.current.isFetchingHighlight).toBe(true)
    })

    nav.searchParams = new URLSearchParams("action=add&tab=list")
    rerender()

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({ type: "openAdd" })
    })

    resolveRpc!({ id: 42, ten_thiet_bi: "CT Scanner" })

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({ type: "openAdd" })
      expect(result.current.isFetchingHighlight).toBe(false)
    })

    expect(nav.replace).toHaveBeenCalledWith("/equipment?tab=list", { scroll: false })
    expect(nav.searchParams.get("tab")).toBe("list")
    expect(nav.searchParams.get("highlight")).toBeNull()
  })
})
