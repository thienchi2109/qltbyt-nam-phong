import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CategoryActionMenu } from "../_components/CategoryActionMenu"
import type { CategoryListItem } from "../_types/categories"

const category: CategoryListItem = {
  id: 1,
  parent_id: null,
  ma_nhom: "G1",
  ten_nhom: "Nhóm thiết bị",
  phan_loai: "A",
  don_vi_tinh: "Cái",
  thu_tu_hien_thi: 1,
  level: 1,
  so_luong_hien_co: 0,
  so_luong_toi_da: null,
  so_luong_toi_thieu: null,
  mo_ta: null,
}

interface CategoryActionMenuHarnessProps {
  callbackMenuState: boolean[]
}

function CategoryActionMenuHarness({ callbackMenuState }: CategoryActionMenuHarnessProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)

  return (
    <>
      <CategoryActionMenu
        category={category}
        disabled={false}
        onEdit={() => {
          callbackMenuState.push(screen.queryByRole("menuitem", { name: "Sửa" }) !== null)
          setIsEditDialogOpen(true)
        }}
        onDelete={vi.fn()}
      />
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa danh mục</DialogTitle>
            <DialogDescription>Cập nhật thông tin danh mục thiết bị</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe("CategoryActionMenu", () => {
  it("closes the edit dialog without leaving page interaction blocked", async () => {
    const user = userEvent.setup()
    const callbackMenuState: boolean[] = []

    render(<CategoryActionMenuHarness callbackMenuState={callbackMenuState} />)

    await user.click(screen.getByRole("button", { name: "Mở menu danh mục Nhóm thiết bị" }))
    await user.click(screen.getByRole("menuitem", { name: "Sửa" }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(callbackMenuState).toEqual([false])

    await user.click(screen.getByRole("button", { name: "Hủy" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(document.body.style.pointerEvents).not.toBe("none")
  })
})
