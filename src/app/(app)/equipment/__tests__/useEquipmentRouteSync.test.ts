import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EQUIPMENT_ATTENTION_ACTION } from "@/lib/equipment-attention-preset"
import { useEquipmentRouteSync } from "../_hooks/useEquipmentRouteSync"

const nav = vi.hoisted(() => ({
  pathname: "/equipment",
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
  }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.searchParams,
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

    const { result } = renderHook(() => useEquipmentRouteSync({ data: [] }))

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({ type: "applyAttentionStatusPreset" })
    })

    expect(nav.replace).toHaveBeenCalledWith("/equipment?page=2&q=abc", { scroll: false })
  })

  it("keeps existing add action behavior", async () => {
    nav.searchParams = new URLSearchParams("action=add&tab=list")

    const { result } = renderHook(() => useEquipmentRouteSync({ data: [] }))

    await waitFor(() => {
      expect(result.current.pendingAction).toEqual({ type: "openAdd" })
    })

    expect(nav.replace).toHaveBeenCalledWith("/equipment?tab=list", { scroll: false })
  })

  it("keeps highlight action behavior and preserves non-transient params", async () => {
    const equipment = { id: 123, ten_thiet_bi: "X-quang" } as any
    nav.searchParams = new URLSearchParams("highlight=123&view=card&page=4")

    const { result } = renderHook(() => useEquipmentRouteSync({ data: [equipment] }))

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
})
