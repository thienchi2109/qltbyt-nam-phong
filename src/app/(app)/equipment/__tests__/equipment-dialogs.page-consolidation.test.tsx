import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/add-equipment-dialog", () => ({
  AddEquipmentDialog: () => <div data-testid="add-dialog" />,
}))

vi.mock("@/components/import-equipment-dialog", () => ({
  ImportEquipmentDialog: () => <div data-testid="import-dialog" />,
}))

vi.mock("../_components/EquipmentDetailDialog", () => ({
  EquipmentDetailDialog: ({
    onEquipmentUpdated,
  }: {
    onEquipmentUpdated?: (patch?: { nguon_kinh_phi?: string }) => void
  }) => {
    detailMock.onEquipmentUpdated = onEquipmentUpdated
    return <div data-testid="detail-dialog" />
  },
}))

vi.mock("../_components/EquipmentDeleteDialog", () => ({
  EquipmentDeleteDialog: () => <div data-testid="delete-dialog" />,
}))

vi.mock("@/components/start-usage-dialog", () => ({
  StartUsageDialog: ({ onSuccess }: { onSuccess?: () => void }) => {
    usageMock.startOnSuccess = onSuccess
    return <div data-testid="start-usage-dialog" />
  },
}))

vi.mock("@/components/end-usage-dialog", () => ({
  EndUsageDialog: ({ onSuccess }: { onSuccess?: () => void }) => {
    usageMock.endOnSuccess = onSuccess
    return <div data-testid="end-usage-dialog" />
  },
}))

vi.mock("@/components/equipment-linked-request", () => ({
  LinkedRequestSheetHost: () => <div data-testid="linked-request-sheet-host" />,
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
    onDataMutationSuccess: contextMock.onDataMutationSuccess,
  }),
}))

const detailMock = vi.hoisted(() => ({
  onEquipmentUpdated: undefined as ((patch?: { nguon_kinh_phi?: string }) => void) | undefined,
}))
const contextMock = vi.hoisted(() => ({
  onDataMutationSuccess: vi.fn(),
}))
const usageMock = vi.hoisted(() => ({
  startOnSuccess: undefined as (() => void) | undefined,
  endOnSuccess: undefined as (() => void) | undefined,
}))

import { EquipmentDialogs } from "../equipment-dialogs"

describe("EquipmentDialogs page consolidation", () => {
  beforeEach(() => {
    detailMock.onEquipmentUpdated = undefined
    contextMock.onDataMutationSuccess.mockClear()
    usageMock.startOnSuccess = undefined
    usageMock.endOnSuccess = undefined
  })

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
    expect(screen.getByTestId("linked-request-sheet-host")).toBeInTheDocument()
  })

  it("uses the updated dataset for repeated edits in the same detail dialog", () => {
    render(
      <EquipmentDialogs
        onGenerateProfileSheet={vi.fn(async () => {})}
        onGenerateDeviceLabel={vi.fn(async () => {})}
        tenantBranding={undefined}
      />
    )

    act(() => detailMock.onEquipmentUpdated?.({ nguon_kinh_phi: "Mượn" }))
    expect(contextMock.onDataMutationSuccess).toHaveBeenLastCalledWith(["regular", "placed"])

    contextMock.onDataMutationSuccess.mockClear()
    act(() => detailMock.onEquipmentUpdated?.({}))

    expect(contextMock.onDataMutationSuccess).toHaveBeenCalledWith("placed")
  })

  it("routes usage mutation success through the shared equipment invalidator", () => {
    render(
      <EquipmentDialogs
        onGenerateProfileSheet={vi.fn(async () => {})}
        onGenerateDeviceLabel={vi.fn(async () => {})}
        tenantBranding={undefined}
      />
    )

    act(() => usageMock.startOnSuccess?.())
    act(() => usageMock.endOnSuccess?.())

    expect(contextMock.onDataMutationSuccess).toHaveBeenCalledTimes(2)
  })
})
