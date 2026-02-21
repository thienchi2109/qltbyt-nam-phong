import * as React from "react"
import { fireEvent, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockOpenDeleteDialog } = vi.hoisted(() => ({
  mockOpenDeleteDialog: vi.fn(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailDetailsTab", () => ({
  EquipmentDetailDetailsTab: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailConfigTab", () => ({
  EquipmentDetailConfigTab: () => <div>Config</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailFilesTab", () => ({
  EquipmentDetailFilesTab: () => <div>Files</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailHistoryTab", () => ({
  EquipmentDetailHistoryTab: () => <div>History</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailUsageTab", () => ({
  EquipmentDetailUsageTab: () => <div>Usage</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailEditForm", () => ({
  EquipmentDetailEditForm: () => <form id="equipment-inline-edit-form" />,
}))

vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentHistory", () => ({
  useEquipmentHistory: () => ({ history: [], isLoading: false }),
}))

vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentAttachments", () => ({
  useEquipmentAttachments: () => ({
    attachments: [],
    isLoading: false,
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    isAdding: false,
    isDeleting: false,
  }),
}))

vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentUpdate", () => ({
  useEquipmentUpdate: () => ({
    updateEquipment: vi.fn(),
    isPending: false,
  }),
}))

vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    openDeleteDialog: mockOpenDeleteDialog,
  }),
}))

import { EquipmentDetailDialog } from "../_components/EquipmentDetailDialog"

describe("EquipmentDetailDialog delete RBAC", () => {
  const equipment = {
    id: 42,
    ma_thiet_bi: "EQ-042",
    ten_thiet_bi: "Monitor",
    khoa_phong_quan_ly: "ICU",
  } as any

  const baseProps = {
    equipment,
    open: true,
    onOpenChange: vi.fn(),
    user: null as any,
    isRegionalLeader: false,
    onGenerateProfileSheet: vi.fn(),
    onGenerateDeviceLabel: vi.fn(),
    onEquipmentUpdated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        writable: true,
        value: vi.fn(),
      })
    }
  })

  it("shows delete button for equipment manager role", () => {
    const { container } = render(
      <EquipmentDetailDialog
        {...baseProps}
        user={{ id: 1, role: "to_qltb", khoa_phong: "ICU" } as any}
      />
    )

    const deleteButton = container.querySelector('button[class*="border-destructive/30"]')
    expect(deleteButton).not.toBeNull()
  })

  it("hides delete button for qltb_khoa even when department matches", () => {
    const { container } = render(
      <EquipmentDetailDialog
        {...baseProps}
        user={{ id: 2, role: "qltb_khoa", khoa_phong: "ICU" } as any}
      />
    )

    const deleteButton = container.querySelector('button[class*="border-destructive/30"]')
    expect(deleteButton).toBeNull()
  })

  it("calls openDeleteDialog with detail source when delete button is clicked", () => {
    const { container } = render(
      <EquipmentDetailDialog
        {...baseProps}
        user={{ id: 1, role: "to_qltb", khoa_phong: "ICU" } as any}
      />
    )

    const deleteButton = container.querySelector('button[class*="border-destructive/30"]')
    expect(deleteButton).not.toBeNull()

    fireEvent.click(deleteButton as HTMLButtonElement)

    expect(mockOpenDeleteDialog).toHaveBeenCalledWith(equipment, "detail_dialog")
  })
})
