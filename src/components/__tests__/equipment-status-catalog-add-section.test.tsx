import * as React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { FormProvider, useForm } from "react-hook-form"
import { expect, it, vi } from "vitest"
import type { AddEquipmentFormValues } from "../add-equipment-dialog.schema"

const catalog = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => catalog(),
}))
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <select>{children}</select>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))
import { AddEquipmentAssignmentSection } from "../add-equipment-dialog.sections"

function Harness() {
  const form = useForm<AddEquipmentFormValues>()
  return (
    <FormProvider {...form}>
      <AddEquipmentAssignmentSection departments={[]} />
    </FormProvider>
  )
}
it("uses active catalog suggestions in the actual add assignment section", () => {
  catalog.mockReturnValue({
    activeValues: ["Hoạt động", "Thanh lý nội bộ", "Đang đánh giá kỹ thuật"],
    canWrite: true,
    refetch: vi.fn(),
  })
  render(<Harness />)
  expect(screen.getByRole("option", { name: "Thanh lý nội bộ" })).toHaveValue("Thanh lý nội bộ")
  expect(screen.getByRole("option", { name: "Đang đánh giá kỹ thuật" })).toHaveValue(
    "Đang đánh giá kỹ thuật"
  )
  expect(screen.queryByRole("option", { name: "Ngưng sử dụng" })).not.toBeInTheDocument()
})
