import * as React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/add-equipment-dialog", () => ({
  AddEquipmentDialog: () => <div data-testid="add-dialog" />,
}))

vi.mock("@/components/import-equipment-dialog", () => ({
  ImportEquipmentDialog: () => <div data-testid="import-dialog" />,
}))

vi.mock("../_components/EquipmentDetailDialog", () => ({
  EquipmentDetailDialog: () => <div data-testid="detail-dialog" />,
}))

vi.mock("../_components/EquipmentDeleteDialog", () => ({
  EquipmentDeleteDialog: () => <div data-testid="delete-dialog" />,
}))

vi.mock("@/components/start-usage-dialog", () => ({
  StartUsageDialog: () => <div data-testid="start-usage-dialog" />,
}))

vi.mock("@/components/end-usage-dialog", () => ({
  EndUsageDialog: () => <div data-testid="end-usage-dialog" />,
}))

vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    user: { id: 1, role: "to_qltb" },
    isRegionalLeader: false,
    dialogState: {
      isAddOpen: false,
      isImportOpen: false,
      isColumnsOpen: false,
      isDetailOpen: true,
      isStartUsageOpen: false,
      isEndUsageOpen: false,
      isDeleteOpen: false,
      detailEquipment: { id: 15, ten_thiet_bi: "Legacy edit" },
      startUsageEquipment: null,
      endUsageLog: null,
      deleteTarget: null,
      deleteSource: null,
    },
    closeAddDialog: vi.fn(),
    closeImportDialog: vi.fn(),
    closeDetailDialog: vi.fn(),
    closeStartUsageDialog: vi.fn(),
    closeEndUsageDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    onDataMutationSuccess: vi.fn(),
  }),
}))

import { EquipmentDialogs } from "../equipment-dialogs"

describe("EquipmentDialogs page consolidation", () => {
  it("mounts only the canonical dialog host tree on the /equipment page", () => {
    render(
      <EquipmentDialogs
        onGenerateProfileSheet={vi.fn(async () => {})}
        onGenerateDeviceLabel={vi.fn(async () => {})}
        tenantBranding={undefined}
      />
    )

    expect(screen.getByTestId("detail-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("add-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("import-dialog")).toBeInTheDocument()
  })
})
