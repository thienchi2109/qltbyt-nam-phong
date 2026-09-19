import userEvent from "@testing-library/user-event"
import { render, screen } from "@testing-library/react"
import { format } from "date-fns"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RepairRequestsCreateSheet } from "../_components/RepairRequestsCreateSheet"

const targetDate = new Date(2026, 8, 22)

const featureMocks = vi.hoisted(() => {
  const createMutate = vi.fn()

  return {
    createMutate,
    context: {
      dialogState: {
        isCreateOpen: true,
        preSelectedEquipment: {
          id: 101,
          ma_thiet_bi: "TB-001",
          ten_thiet_bi: "Máy siêu âm A",
          khoa_phong_quan_ly: "CDHA",
        },
      },
      closeAllDialogs: vi.fn(),
      createMutation: {
        mutate: createMutate,
        isPending: false,
      },
      user: { full_name: "Test User", username: "tester" },
      canSetRepairUnit: false,
      assistantDraft: null,
    },
  }
})

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: () => featureMocks.context,
}))

vi.mock("../repair-requests-equipment-rpc", () => ({
  fetchRepairRequestEquipmentList: vi.fn().mockResolvedValue([]),
}))

function getTargetDayButton(): HTMLElement {
  const dayButton = screen.getAllByRole("button", { hidden: true }).find((button) => {
    return (
      button.textContent?.trim() === String(targetDate.getDate()) &&
      button.getAttribute("aria-label")?.includes(String(targetDate.getFullYear()))
    )
  })

  expect(dayButton).toBeDefined()
  expect(dayButton).toBeVisible()
  expect(dayButton).toBeEnabled()
  return dayButton as HTMLElement
}

function RepairRequestsCalendarPopover({
  onSelect,
}: {
  onSelect: (date: Date | undefined) => void
}) {
  return (
    <Popover open onOpenChange={() => {}}>
      <PopoverTrigger asChild>
        <button type="button">Choose date</button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar mode="single" defaultMonth={targetDate} onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  )
}

describe("repair request date picker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 19, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows selecting an enabled date outside a side-sheet", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(<RepairRequestsCalendarPopover onSelect={onSelect} />)

    expect(document.querySelectorAll("[data-radix-popper-content-wrapper]")).toHaveLength(1)
    expect(screen.getByRole("grid", { hidden: true })).toBeInTheDocument()
    await user.click(getTargetDayButton())

    expect(onSelect.mock.calls[0]?.[0]).toEqual(targetDate)
  })

  it("allows selecting an enabled date while the create side-sheet is open", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <SideSheetShell open onOpenChange={() => {}} title="Create repair request">
        <RepairRequestsCalendarPopover onSelect={onSelect} />
      </SideSheetShell>
    )

    expect(screen.getByRole("grid", { hidden: true })).toBeInTheDocument()
    await user.click(getTargetDayButton())

    expect(onSelect.mock.calls[0]?.[0]).toEqual(targetDate)
  })

  it("selects and submits a future date from the real create sheet", async () => {
    const user = userEvent.setup()
    featureMocks.createMutate.mockClear()

    render(<RepairRequestsCreateSheet />)

    const dateTrigger = screen.getByRole("button", { name: /Ngày mong muốn hoàn thành/ })
    await user.click(dateTrigger)
    await user.click(getTargetDayButton())

    expect(screen.queryByRole("grid", { hidden: true })).not.toBeInTheDocument()
    expect(dateTrigger).toHaveAttribute("aria-expanded", "false")
    expect(dateTrigger).toHaveFocus()
    expect(screen.getByText(format(targetDate, "dd/MM/yyyy"))).toBeInTheDocument()

    await user.click(dateTrigger)
    expect(dateTrigger).toHaveAttribute("aria-expanded", "true")
    expect(getTargetDayButton().closest('[role="gridcell"]')).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await user.click(dateTrigger)
    expect(dateTrigger).toHaveAttribute("aria-expanded", "false")

    await user.type(screen.getByLabelText("Mô tả sự cố"), "Mất nguồn đột ngột")
    await user.click(screen.getByRole("button", { name: "Gửi yêu cầu" }))

    expect(featureMocks.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        ngay_mong_muon_hoan_thanh: format(targetDate, "yyyy-MM-dd"),
      }),
      expect.objectContaining({ onSuccess: featureMocks.context.closeAllDialogs })
    )
  })
})
