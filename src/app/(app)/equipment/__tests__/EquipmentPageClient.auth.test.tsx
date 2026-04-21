import * as React from "react"
import "@testing-library/jest-dom"
import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"

const state = vi.hoisted(() => ({
  pageState: null as null | {
    status: "unauthenticated"
    router: {
      push: Mock
      replace: Mock
    }
  },
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("../use-equipment-page", () => ({
  useEquipmentPage: () => state.pageState,
}))

vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    openAddDialog: vi.fn(),
    openImportDialog: vi.fn(),
    openColumnsDialog: vi.fn(),
    openDetailDialog: vi.fn(),
    openEditDialog: vi.fn(),
  }),
}))

vi.mock("../_components/EquipmentDialogContext", () => ({
  EquipmentDialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../equipment-content", () => ({
  EquipmentContent: () => null,
}))

vi.mock("../equipment-dialogs", () => ({
  EquipmentDialogs: () => null,
}))

vi.mock("../_components/EquipmentColumnsDialog", () => ({
  EquipmentColumnsDialog: () => null,
}))

vi.mock("../_components/EquipmentBulkDeleteBar", () => ({
  EquipmentBulkDeleteBar: () => null,
}))

vi.mock("@/components/equipment/equipment-toolbar", () => ({
  EquipmentToolbar: () => null,
}))

vi.mock("@/components/equipment/filter-bottom-sheet", () => ({
  FilterBottomSheet: () => null,
}))

vi.mock("@/components/shared/DataTablePagination", () => ({
  DataTablePagination: () => null,
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => null,
}))

import { EquipmentPageClient } from "../_components/EquipmentPageClient"

describe("EquipmentPageClient auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.pageState = {
      status: "unauthenticated",
      router: {
        push: mocks.push,
        replace: mocks.replace,
      },
    }
  })

  it("does not redirect unauthenticated users from the feature client", () => {
    const { container } = render(<EquipmentPageClient />)

    expect(container).toBeEmptyDOMElement()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
