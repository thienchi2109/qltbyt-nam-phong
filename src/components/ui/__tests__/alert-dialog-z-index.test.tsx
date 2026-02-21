import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

describe("AlertDialog layering", () => {
  it("renders above dialog layer", () => {
    render(
      <AlertDialog open onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm delete</AlertDialogTitle>
          <AlertDialogDescription>Move this equipment to trash.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )

    const content = screen.getByRole("alertdialog")
    const overlay = document.querySelector<HTMLElement>('div[class*="bg-black/80"]')

    // Dialog uses z-[999]/z-[1000].
    expect(content.className).toContain("z-[1101]")
    expect(overlay?.className ?? "").toContain("z-[1100]")
  })

  it("renders above sheet layer", () => {
    render(
      <>
        <Sheet open onOpenChange={() => {}}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Sheet title</SheetTitle>
              <SheetDescription>Sheet description</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
        <AlertDialog open onOpenChange={() => {}}>
          <AlertDialogContent>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>Move this equipment to trash.</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )

    const alertContent = screen.getByRole("alertdialog", { hidden: true })
    const sheetLayer = document.querySelector<HTMLElement>('div[class*="z-[1002]"]')

    // Sheet uses z-[1002]; AlertDialog must always be top-most.
    expect(alertContent.className).toContain("z-[1101]")
    expect(sheetLayer).toBeTruthy()
  })
})
