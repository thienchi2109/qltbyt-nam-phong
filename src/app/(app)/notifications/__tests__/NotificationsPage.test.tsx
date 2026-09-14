import * as React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import NotificationsPage from "../page"

const mocks = vi.hoisted(() => ({ session: vi.fn(), tenant: vi.fn(), fetch: vi.fn() }))
vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/contexts/TenantSelectionContext", () => ({ useTenantSelection: () => mocks.tenant() }))
vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button>Đơn vị mục tiêu</button>,
}))
const alice = { user_id: "11", username: "alice", full_name: "Alice Nguyen" }
const bob = { user_id: "12", username: "bob", full_name: "Bob Tran" }
const selectedAlice = { ...alice, status: "eligible", protected: false, editable: true }
const protectedAdmin = {
  user_id: "99",
  username: "admin",
  full_name: "Admin",
  status: "eligible",
  protected: true,
  editable: false,
}
const stale = {
  user_id: "13",
  username: "stale",
  full_name: "Stale",
  status: "ineligible",
  protected: false,
  editable: true,
}
const response = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status })
const config = (target = "7", recipients: unknown[] = []) =>
  response({ version: 1, don_vi_id: target, recipients })
const candidates = (target = "7", rows = [alice], next: string | null = null) =>
  response({ version: 1, don_vi_id: target, candidates: rows, next_cursor: next })
function deferred() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function session(role = "global", unit = 7, id = "99") {
  mocks.session.mockReturnValue({
    status: "authenticated",
    data: { user: { id, role, don_vi: 4, current_don_vi: unit } },
  })
}
function target(unit: number | null = 7) {
  mocks.tenant.mockReturnValue({ selectedFacilityId: unit, showSelector: true })
}
function mount() {
  const client = createTestQueryClient()
  const view = render(<NotificationsPage />, { wrapper: createReactQueryWrapper(client) })
  return { ...view, client }
}
const saveButton = () => screen.getByRole("button", { name: "Lưu người nhận" })
const aliceBox = () => screen.getByRole("checkbox", { name: "Alice Nguyen (alice)" })

beforeEach(() => {
  vi.clearAllMocks()
  session()
  target()
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockImplementation((input: RequestInfo | URL) =>
    Promise.resolve(String(input).includes("/config") ? config() : candidates())
  )
})
afterEach(() => vi.unstubAllGlobals())

describe("NotificationsPage Chunk 5.1", () => {
  it.each(["technician", "user", "qltb_khoa", "regional_leader", "technical_configuration_expert"])(
    "shows guidance without recipient requests for %s",
    (role) => {
      session(role)
      mount()
      expect(screen.getByRole("heading", { name: "Cài đặt nhận thông báo" })).toBeInTheDocument()
      expect(screen.queryByText("Người nhận thông báo")).not.toBeInTheDocument()
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )
  it.each(["admin", "global"])(
    "offers target selector before a target is chosen for %s",
    (role) => {
      session(role)
      target(null)
      mount()
      expect(screen.getByRole("button", { name: "Đơn vị mục tiêu" })).toBeInTheDocument()
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )
  it("uses only the manager effective unit and serializes an explicit self_action", async () => {
    session("to_qltb", 9)
    mocks.fetch.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(String(input).includes("/config") ? config("9") : candidates("9"))
    )
    const user = userEvent.setup()
    mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.queryByRole("button", { name: "Đơn vị mục tiêu" })).not.toBeInTheDocument()
    await user.click(aliceBox())
    await user.click(saveButton())
    const put = mocks.fetch.mock.calls.find(([, init]) => init?.method === "PUT")
    expect(JSON.parse(put?.[1].body)).toEqual({
      version: 1,
      don_vi_id: "9",
      usernames: "alice",
      self_action: "none",
    })
    expect(
      mocks.fetch.mock.calls
        .filter(([, init]) => !init?.method)
        .every(([url]) => String(url).includes("don_vi_id=9"))
    ).toBe(true)
  })
  it("gates editing and Save until full config arrives, then supports keyboard selection", async () => {
    const loading = deferred()
    mocks.fetch.mockImplementation((input: RequestInfo | URL) =>
      String(input).includes("/config") ? loading.promise : Promise.resolve(candidates())
    )
    const user = userEvent.setup()
    mount()
    await screen.findByRole("checkbox", { name: "Alice Nguyen (alice)" })
    expect(saveButton()).toBeDisabled()
    expect(aliceBox()).toBeDisabled()
    await act(async () => loading.resolve(config()))
    await waitFor(() => expect(aliceBox()).toBeEnabled())
    aliceBox().focus()
    await user.keyboard(" ")
    expect(aliceBox()).toBeChecked()
    await user.keyboard(" ")
    expect(aliceBox()).not.toBeChecked()
  })
  it("retains full-config and unsaved selections across name search, pagination and errors", async () => {
    mocks.fetch.mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname.endsWith("config"))
        return Promise.resolve(config("7", [protectedAdmin, stale]))
      if (url.searchParams.get("q")) return Promise.resolve(response({}, 500))
      return Promise.resolve(
        url.searchParams.has("cursor") ? candidates("7", [bob]) : candidates("7", [alice], "11")
      )
    })
    const user = userEvent.setup()
    mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(screen.getByText("Admin (admin)")).toBeInTheDocument()
    expect(screen.getByText("Stale (stale)")).toBeInTheDocument()
    await user.click(aliceBox())
    await user.click(screen.getByRole("button", { name: "Tải thêm tài khoản" }))
    await screen.findByRole("checkbox", { name: "Bob Tran (bob)" })
    expect(aliceBox()).toBeChecked()
    await user.type(screen.getByRole("searchbox", { name: "Tìm tài khoản" }), "Nguyen")
    await screen.findByRole("alert")
    expect(screen.getByText("Đã chọn: 3")).toBeInTheDocument()
    expect(screen.getByText("Alice Nguyen (alice)")).toBeInTheDocument()
    expect(screen.queryByLabelText(/nhập username|csv/i)).not.toBeInTheDocument()
  })
  it("retains the draft and disables Save after a failed reload, including recovery", async () => {
    let calls = 0
    mocks.fetch.mockImplementation((input: RequestInfo | URL) => {
      if (!String(input).includes("/config")) return Promise.resolve(candidates())
      calls++
      return Promise.resolve(calls === 2 ? response({}, 500) : config())
    })
    const user = userEvent.setup()
    mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(aliceBox())
    await user.click(screen.getByRole("button", { name: "Tải lại cấu hình" }))
    await screen.findByRole("alert")
    expect(aliceBox()).toBeChecked()
    expect(saveButton()).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Tải lại cấu hình" }))
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(aliceBox()).toBeChecked()
  })
  it("does not overwrite a draft on background config refresh", async () => {
    const user = userEvent.setup()
    const { client } = mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(aliceBox())
    await act(async () => {
      await client.refetchQueries({ type: "active" })
    })
    expect(aliceBox()).toBeChecked()
  })
  it("locks selection while Save is pending and uses the atomic returned config", async () => {
    const saving = deferred()
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PUT"
        ? saving.promise
        : Promise.resolve(String(input).includes("/config") ? config() : candidates())
    )
    const user = userEvent.setup()
    mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(aliceBox())
    await user.click(saveButton())
    expect(aliceBox()).toBeDisabled()
    await user.click(aliceBox())
    await act(async () => saving.resolve(config("7", [selectedAlice])))
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(aliceBox()).toBeChecked()
    expect(screen.getByText("Đã lưu danh sách người nhận.")).toBeInTheDocument()
  })

  it("preserves protected entries outside normal username serialization", async () => {
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PUT"
        ? Promise.resolve(config("7", [protectedAdmin]))
        : Promise.resolve(
            String(input).includes("/config") ? config("7", [protectedAdmin]) : candidates()
          )
    )
    const user = userEvent.setup()
    mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    const put = mocks.fetch.mock.calls.find(([, init]) => init?.method === "PUT")
    expect(JSON.parse(put?.[1].body).usernames).toBe("")
    expect(JSON.parse(put?.[1].body).self_action).toBe("none")
  })
  it("preserves a failed Save draft without retrying the mutation", async () => {
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "PUT"
          ? response({}, 500)
          : String(input).includes("/config")
            ? config()
            : candidates()
      )
    )
    const user = userEvent.setup()
    mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(aliceBox())
    await user.click(saveButton())
    await screen.findByRole("alert")
    expect(aliceBox()).toBeChecked()
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1)
  })
  it("isolates old config and Save responses when the target changes", async () => {
    const saving = deferred()
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") return saving.promise
      const unit = new URL(String(input), "http://localhost").searchParams.get("don_vi_id") ?? "7"
      return Promise.resolve(
        String(input).includes("/config")
          ? config(unit)
          : candidates(unit, unit === "7" ? [alice] : [bob])
      )
    })
    const user = userEvent.setup()
    const view = mount()
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(aliceBox())
    await user.click(saveButton())
    target(9)
    view.rerender(<NotificationsPage />)
    await screen.findByRole("checkbox", { name: "Bob Tran (bob)" })
    expect(screen.getByText("Đã chọn: 0")).toBeInTheDocument()
    await act(async () => saving.resolve(config("7", [selectedAlice])))
    expect(screen.queryByText("Alice Nguyen (alice)")).not.toBeInTheDocument()
    expect(screen.queryByText("Đã lưu danh sách người nhận.")).not.toBeInTheDocument()
  })
  it("rejects malformed full config instead of enabling destructive Save", async () => {
    mocks.fetch.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).includes("/config")
          ? response({ version: 1, don_vi_id: "9", recipients: [] })
          : candidates()
      )
    )
    mount()
    await screen.findByRole("alert")
    expect(saveButton()).toBeDisabled()
  })
})
