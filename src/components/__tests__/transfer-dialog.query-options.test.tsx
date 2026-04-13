import "@testing-library/jest-dom"
import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(() => ({
    data: [],
    error: null,
    errorUpdatedAt: 0,
    isFetching: false,
    isLoading: false,
  })),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}))

vi.mock("@/hooks/use-debounce", () => ({
  useSearchDebounce: (value: string) => value,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { useTransferEquipmentSearch } from "@/components/transfer-dialog.data"

describe("transfer-dialog query options", () => {
  it("disables automatic retries for equipment search queries", () => {
    renderHook(() =>
      useTransferEquipmentSearch({
        open: true,
        canSearch: true,
        searchTerm: "Máy",
        skipSearch: false,
      }),
    )

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        retry: false,
      }),
    )
  })
})
