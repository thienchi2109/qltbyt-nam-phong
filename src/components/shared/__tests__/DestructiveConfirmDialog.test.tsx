import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DestructiveConfirmDialog } from "../DestructiveConfirmDialog"

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { readonly className?: string }) => (
    <svg aria-hidden="true" className={className} data-testid="pending-spinner" />
  ),
}))

const alertDialogMockState = vi.hoisted(() => ({
  onOpenChange: undefined as ((open: boolean) => void) | undefined,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly children: React.ReactNode
  }) => {
    alertDialogMockState.onOpenChange = onOpenChange

    return open ? (
      <div data-testid="alert-dialog">
        <button type="button" onClick={() => onOpenChange(false)}>
          mock close
        </button>
        {children}
      </div>
    ) : null
  },
  AlertDialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    readonly children: React.ReactNode
    readonly disabled?: boolean
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    className,
    disabled,
    onClick,
  }: {
    readonly children: React.ReactNode
    readonly className?: string
    readonly disabled?: boolean
    readonly onClick?: () => void
  }) => (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        onClick?.()
        alertDialogMockState.onOpenChange?.(false)
      }}
    >
      {children}
    </button>
  ),
}))

describe("DestructiveConfirmDialog", () => {
  it("renders the confirmation copy and calls the confirm action", () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <DestructiveConfirmDialog
        open
        title="Bạn có chắc chắn muốn xóa?"
        description={<span>Xóa bản ghi này vĩnh viễn.</span>}
        confirmLabel="Xóa"
        isPending={false}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    )

    expect(screen.getByRole("heading", { name: "Bạn có chắc chắn muốn xóa?" })).toBeInTheDocument()
    expect(screen.getByText("Xóa bản ghi này vĩnh viễn.")).toBeInTheDocument()

    const confirmButton = screen.getByRole("button", { name: "Xóa" })
    expect(confirmButton).toHaveClass("bg-destructive")

    fireEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("forwards close changes when not pending", () => {
    const onOpenChange = vi.fn()

    render(
      <DestructiveConfirmDialog
        open
        title="Xóa danh mục"
        description="Không thể hoàn tác."
        confirmLabel="Xóa danh mục"
        isPending={false}
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "mock close" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("keeps the dialog open and disables actions while pending", () => {
    const onOpenChange = vi.fn()

    render(
      <DestructiveConfirmDialog
        open
        title="Xóa danh mục"
        description="Không thể hoàn tác."
        confirmLabel="Xóa danh mục"
        isPending
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
      />
    )

    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Xóa danh mục" })).toBeDisabled()
    expect(screen.getByTestId("pending-spinner")).toHaveClass("animate-spin")

    fireEvent.click(screen.getByRole("button", { name: "mock close" }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
