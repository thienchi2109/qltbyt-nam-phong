import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@testing-library/jest-dom"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Equipment, UsageLog } from "@/types/database"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  openDetailDialog: vi.fn(),
  openStartUsageDialog: vi.fn(),
  openEndUsageDialog: vi.fn(),
  openDeleteDialog: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/app/(app)/equipment/_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    user: {
      id: 1,
      role: "to_qltb",
    },
    isGlobal: false,
    isRegionalLeader: false,
    openDetailDialog: mocks.openDetailDialog,
    openStartUsageDialog: mocks.openStartUsageDialog,
    openEndUsageDialog: mocks.openEndUsageDialog,
    openDeleteDialog: mocks.openDeleteDialog,
  }),
}))

import { EquipmentActionsMenu } from "../../../../components/equipment/equipment-actions-menu"

const equipment = {
  id: 101,
  ten_thiet_bi: "Máy thở test",
} as unknown as Equipment

const callbackMenuState: boolean[] = []

function EquipmentDetailWorkflowHarness() {
  const [detailEquipment, setDetailEquipment] = React.useState<Equipment | null>(null)
  const [pageClicks, setPageClicks] = React.useState(0)

  React.useEffect(() => {
    mocks.openDetailDialog.mockImplementation((selectedEquipment: Equipment) => {
      callbackMenuState.push(screen.queryByRole("menuitem", { name: "Xem chi tiết" }) !== null)
      setDetailEquipment(selectedEquipment)
    })
  }, [])

  return (
    <div>
      <EquipmentActionsMenu
        equipment={equipment}
        activeUsageLogs={[] as UsageLog[]}
        isLoadingActiveUsage={false}
      />
      <Dialog
        open={detailEquipment !== null}
        onOpenChange={(open) => !open && setDetailEquipment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết thiết bị</DialogTitle>
            <DialogDescription>{detailEquipment?.ten_thiet_bi}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setDetailEquipment(null)}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <button type="button" onClick={() => setPageClicks((count) => count + 1)}>
        Nút nền {pageClicks}
      </button>
    </div>
  )
}

describe("EquipmentActionsMenu overlay workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callbackMenuState.length = 0
    document.body.style.pointerEvents = ""
  })

  it("opens details from the row menu, closes the dialog, and keeps the page interactive", async () => {
    const user = userEvent.setup()
    render(<EquipmentDetailWorkflowHarness />)

    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(screen.getByRole("menuitem", { name: "Xem chi tiết" }))

    expect(await screen.findByRole("dialog", { name: "Chi tiết thiết bị" })).toBeInTheDocument()
    expect(callbackMenuState).toEqual([false])
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Xem chi tiết" })).toBeNull())

    await user.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Chi tiết thiết bị" })).not.toBeInTheDocument()
    )
    expect(document.body.style.pointerEvents).not.toBe("none")

    await user.click(screen.getByRole("button", { name: "Nút nền 0" }))
    expect(screen.getByRole("button", { name: "Nút nền 1" })).toBeInTheDocument()
  })
})
