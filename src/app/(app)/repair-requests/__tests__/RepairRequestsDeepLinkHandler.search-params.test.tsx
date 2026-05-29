import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
  replace: vi.fn(),
  useRepairRequestsDeepLink: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock("../_hooks/useRepairRequestsDeepLink", () => ({
  useRepairRequestsDeepLink: mocks.useRepairRequestsDeepLink,
}))

import { RepairRequestsDeepLinkHandler } from "../_components/RepairRequestsDeepLinkHandler"

function renderHandler() {
  return render(
    <RepairRequestsDeepLinkHandler
      toast={vi.fn()}
      uiFilters={{ status: [], dateRange: null }}
      setUiFiltersState={vi.fn()}
      setUiFilters={vi.fn()}
      openCreateSheet={vi.fn()}
      applyAssistantDraft={vi.fn()}
      queryClient={{
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
      }}
    />,
  )
}

describe("RepairRequestsDeepLinkHandler", () => {
  it.each(["pushState", "replaceState"] as const)(
    "refreshes search params after same-page history.%s navigation",
    (historyMethod) => {
    mocks.usePathname.mockReturnValue("/repair-requests")

    window.history.replaceState(null, "", "/repair-requests")
    renderHandler()

    act(() => {
      window.history[historyMethod](null, "", "/repair-requests?action=view&requestId=42")
    })

    const latestOptions =
      mocks.useRepairRequestsDeepLink.mock.calls.at(-1)?.[0]

    expect(latestOptions.searchParams.get("action")).toBe("view")
    expect(latestOptions.searchParams.get("requestId")).toBe("42")
    },
  )
})
