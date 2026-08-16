import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { isEquipmentManagerRole } from "@/lib/rbac"
import { callRpc } from "@/lib/rpc-client"
import { DeviceQuotaCategoryAssignedEquipment } from "../_components/DeviceQuotaCategoryAssignedEquipment"
import { deviceQuotaCategoryAssignedEquipmentQueryKey } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

type UnassignmentRequest = {
  equipmentId: number
  expectedCategoryId: number
  donViId: number
}

const assignedEquipment: EquipmentPreviewItem = {
  id: 101,
  ma_thiet_bi: "TB-001",
  ten_thiet_bi: "Máy X quang GE OEC",
  model: "OEC 9900",
  serial: "SN12345",
  hang_san_xuat: "GE Healthcare",
  khoa_phong_quan_ly: "Khoa CĐHA",
  tinh_trang: "Hoạt động",
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderSubject({
  role = "global",
  onContainerClick = vi.fn(),
  onContainerPointerDown = vi.fn(),
  onContainerKeyDown = vi.fn(),
  onUnassign = vi.fn(),
  includeUnassignmentProps = true,
}: {
  role?: string | null
  onContainerClick?: () => void
  onContainerPointerDown?: () => void
  onContainerKeyDown?: () => void
  onUnassign?: (request: UnassignmentRequest) => void | Promise<void>
  includeUnassignmentProps?: boolean
} = {}) {
  mockCallRpc.mockResolvedValue([assignedEquipment])
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  const renderResult = render(
    <div
      onClick={onContainerClick}
      onPointerDown={onContainerPointerDown}
      onKeyDown={onContainerKeyDown}
    >
      <DeviceQuotaCategoryAssignedEquipment
        nhomId={42}
        donViId={7}
        {...(includeUnassignmentProps
          ? {
              canUnassign: isEquipmentManagerRole(role),
              categoryName: "Chẩn đoán hình ảnh",
              onUnassign,
            }
          : {})}
      />
    </div>,
    { wrapper: createWrapper(queryClient) }
  )

  return {
    onContainerClick,
    onContainerPointerDown,
    onContainerKeyDown,
    onUnassign,
    queryClient,
    ...renderResult,
  }
}

async function getUnassignmentButton() {
  await screen.findByText(assignedEquipment.ma_thiet_bi)
  return screen.getByRole("button", { name: "Bỏ khỏi danh mục" })
}

describe("DeviceQuotaCategoryAssignedEquipment category unassignment RED contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(["global", "admin", "to_qltb"])(
    "shows the trailing Lucide X action for the %s role",
    async (role) => {
      renderSubject({ role })

      const action = await getUnassignmentButton()

      expect(action).toBeInTheDocument()
      expect(action.querySelector("svg.lucide-x")).toBeInTheDocument()
      expect(action.closest("td")).toBe(within(action.closest("tr")!).getAllByRole("cell").at(-1))
    }
  )

  it.each(["regional_leader", "qltb_khoa", "technician", "user", null])(
    "does not expose the unlink action for the %s role",
    async (role) => {
      const unauthorized = renderSubject({ role })

      await screen.findByText(assignedEquipment.ma_thiet_bi)

      expect(screen.queryByRole("button", { name: "Bỏ khỏi danh mục" })).not.toBeInTheDocument()
      expect(screen.queryByRole("columnheader", { name: "Hành động" })).not.toBeInTheDocument()
      expect(unauthorized.container.innerHTML).not.toContain("Bỏ khỏi danh mục")

      const unauthorizedMarkup = unauthorized.container.innerHTML
      unauthorized.unmount()

      const readOnlyBaseline = renderSubject({ role, includeUnassignmentProps: false })
      await screen.findByText(assignedEquipment.ma_thiet_bi)

      expect(readOnlyBaseline.container.innerHTML).toBe(unauthorizedMarkup)
    }
  )

  it("shows the exact Bỏ khỏi danh mục tooltip", async () => {
    const user = userEvent.setup()
    renderSubject()
    const action = await getUnassignmentButton()

    await user.hover(action)

    expect(await screen.findByRole("tooltip", { name: "Bỏ khỏi danh mục" })).toBeVisible()
  })

  it("isolates pointer and keyboard action events from the containing row", async () => {
    const user = userEvent.setup()
    const onContainerClick = vi.fn()
    const onContainerPointerDown = vi.fn()
    const onContainerKeyDown = vi.fn()
    const { onUnassign } = renderSubject({
      onContainerClick,
      onContainerPointerDown,
      onContainerKeyDown,
    })
    const action = await getUnassignmentButton()

    await user.click(action)

    const dialog = screen.getByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }))
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(onContainerClick).not.toHaveBeenCalled()
    expect(onContainerPointerDown).not.toHaveBeenCalled()
    expect(onContainerKeyDown).not.toHaveBeenCalled()

    action.focus()
    await user.keyboard("{Enter}")

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(onContainerClick).not.toHaveBeenCalled()
    expect(onContainerPointerDown).not.toHaveBeenCalled()
    expect(onContainerKeyDown).not.toHaveBeenCalled()

    await user.click(action)
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Bỏ khỏi danh mục",
      })
    )
    await waitFor(() => {
      expect(onUnassign).toHaveBeenCalledTimes(1)
    })
    expect(onContainerClick).not.toHaveBeenCalled()
    expect(onContainerPointerDown).not.toHaveBeenCalled()
    expect(onContainerKeyDown).not.toHaveBeenCalled()
  })

  it("cancels without sending an unassignment request", async () => {
    const user = userEvent.setup()
    const onUnassign = vi.fn()
    const { queryClient } = renderSubject({ onUnassign })
    const action = await getUnassignmentButton()
    const assignedQueryKey = deviceQuotaCategoryAssignedEquipmentQueryKey(42, 7)
    const categoryListKey = ["dinh_muc_nhom_list", { donViId: 7 }] as const
    queryClient.setQueryData(categoryListKey, [
      {
        id: 42,
        ten_nhom: "Chẩn đoán hình ảnh",
        so_luong_hien_co: 1,
      },
    ])
    const cacheSnapshot = structuredClone({
      assigned: queryClient.getQueryData(assignedQueryKey),
      categories: queryClient.getQueryData(categoryListKey),
      assignedInvalidated: queryClient.getQueryState(assignedQueryKey)?.isInvalidated,
      categoriesInvalidated: queryClient.getQueryState(categoryListKey)?.isInvalidated,
    })
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData")
    const setQueriesDataSpy = vi.spyOn(queryClient, "setQueriesData")
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries")
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries")

    await user.click(action)

    const dialog = screen.getByRole("alertdialog")
    expect(dialog).toHaveTextContent(assignedEquipment.ten_thiet_bi)
    expect(dialog).toHaveTextContent("Chẩn đoán hình ảnh")

    await user.click(within(dialog).getByRole("button", { name: "Hủy" }))

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(onUnassign).not.toHaveBeenCalled()
    expect({
      assigned: queryClient.getQueryData(assignedQueryKey),
      categories: queryClient.getQueryData(categoryListKey),
      assignedInvalidated: queryClient.getQueryState(assignedQueryKey)?.isInvalidated,
      categoriesInvalidated: queryClient.getQueryState(categoryListKey)?.isInvalidated,
    }).toEqual(cacheSnapshot)
    expect(setQueryDataSpy).not.toHaveBeenCalled()
    expect(setQueriesDataSpy).not.toHaveBeenCalled()
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
    expect(cancelQueriesSpy).not.toHaveBeenCalled()
    expect(action).toHaveFocus()
  })

  it("closes without mutation on Escape and returns focus to the row action", async () => {
    const user = userEvent.setup()
    const onUnassign = vi.fn()
    renderSubject({ onUnassign })
    const action = await getUnassignmentButton()

    await user.click(action)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(onUnassign).not.toHaveBeenCalled()
    expect(action).toHaveFocus()
  })

  it("confirms exactly one equipment/category/tenant unassignment request", async () => {
    const user = userEvent.setup()
    const onUnassign = vi.fn().mockResolvedValue(undefined)
    renderSubject({ onUnassign })
    const action = await getUnassignmentButton()

    await user.click(action)
    const dialog = screen.getByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Bỏ khỏi danh mục" }))

    await waitFor(() => {
      expect(onUnassign).toHaveBeenCalledTimes(1)
    })
    expect(onUnassign).toHaveBeenCalledWith({
      equipmentId: 101,
      expectedCategoryId: 42,
      donViId: 7,
    })
  })

  it("disables the row action and dialog controls while confirmation is pending", async () => {
    const user = userEvent.setup()
    const deferred = createDeferred()
    const onUnassign = vi.fn(() => deferred.promise)
    renderSubject({ onUnassign })
    const action = await getUnassignmentButton()

    await user.click(action)
    const dialog = screen.getByRole("alertdialog")
    const cancel = within(dialog).getByRole("button", { name: "Hủy" })
    const confirm = within(dialog).getByRole("button", { name: "Bỏ khỏi danh mục" })

    await user.click(confirm)

    expect(onUnassign).toHaveBeenCalledTimes(1)
    expect(action).toBeDisabled()
    expect(cancel).toBeDisabled()
    expect(confirm).toBeDisabled()

    deferred.resolve()

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(action).toHaveFocus()
  })
})
