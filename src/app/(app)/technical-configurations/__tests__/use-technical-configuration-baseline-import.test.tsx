import "@testing-library/jest-dom"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  technicalConfigurationBaselineVersionsQueryKey,
  technicalConfigurationDossierDetailQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import type { TechnicalConfigurationBaselineVersionPages } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"

import {
  baselineVersionsResponse,
  createBaselineImportFile,
  createBaselineImportPayload,
  createBaselineImportPreview,
  createDraft,
  createLockedVersion,
  createPersistentQueryClient,
  dossier,
  getBaselineImportCodecMock,
  getBaselineRpcMock,
  mockVersions,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()
const codec = getBaselineImportCodecMock()

describe("useTechnicalConfigurationBaselineImport workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    codec.readExcelFile.mockResolvedValue({
      SheetNames: ["Baseline", "_meta"],
      Sheets: {},
      _workbook: {},
    })
    codec.parseWorkbook.mockResolvedValue([createBaselineImportPayload()])
    rpc.previewImport.mockResolvedValue(createBaselineImportPreview())
  })

  it("does not persist before confirmation, then adopts one atomic apply snapshot and cache update", async () => {
    const user = userEvent.setup()
    const queryClient = createPersistentQueryClient()
    const draft = createDraft()
    const imported = createDraft({
      revision: 5,
      next_criterion_number: 3,
      groups: draft.groups.map((group, index) =>
        index === 0
          ? {
              ...group,
              criteria: [
                {
                  ...group.criteria[0],
                  id: "criterion-2",
                  criterion_code: "TC-0002",
                  title: "Nguồn điện",
                  requirement_text: "Nguồn điện dự phòng",
                },
              ],
            }
          : group
      ),
    })
    mockVersions([draft])
    rpc.applyImport.mockResolvedValue({ data: imported })
    rpc.getDossier.mockResolvedValue({
      data: { ...dossier, revision: dossier.revision + 1 },
    })
    queryClient.setQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id), {
      data: dossier,
    })

    renderTab(vi.fn(), queryClient)
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile()] },
    })

    expect(await screen.findByText("TC-0002")).toBeInTheDocument()
    expect(rpc.previewImport).toHaveBeenCalledTimes(1)
    expect(rpc.applyImport).not.toHaveBeenCalled()
    expect(rpc.createGroup).not.toHaveBeenCalled()
    expect(rpc.updateGroup).not.toHaveBeenCalled()
    expect(rpc.createCriterion).not.toHaveBeenCalled()
    expect(rpc.updateCriterion).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))

    await waitFor(() =>
      expect(rpc.applyImport).toHaveBeenCalledWith({
        p_baseline_version_id: draft.id,
        p_template_metadata: createBaselineImportPayload().metadata,
        p_rows: createBaselineImportPayload().rows,
        p_expected_revision: draft.revision,
      })
    )
    expect(rpc.applyImport).toHaveBeenCalledTimes(1)
    expect(rpc.createGroup).not.toHaveBeenCalled()
    expect(rpc.updateGroup).not.toHaveBeenCalled()
    expect(rpc.deleteGroup).not.toHaveBeenCalled()
    expect(rpc.reorderGroups).not.toHaveBeenCalled()
    expect(rpc.createCriterion).not.toHaveBeenCalled()
    expect(rpc.updateCriterion).not.toHaveBeenCalled()
    expect(rpc.deleteCriterion).not.toHaveBeenCalled()
    expect(rpc.reorderCriteria).not.toHaveBeenCalled()
    expect(await screen.findByDisplayValue("Nguồn điện dự phòng")).toBeInTheDocument()

    const cachedVersions = queryClient.getQueryData<TechnicalConfigurationBaselineVersionPages>(
      technicalConfigurationBaselineVersionsQueryKey(dossier.id)
    )
    expect(cachedVersions?.pages[0].data[0]).toEqual(imported)
    expect(rpc.getDossier).toHaveBeenCalledWith(dossier.id)
    expect(
      queryClient.getQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id))
    ).toEqual({
      data: { ...dossier, revision: dossier.revision + 1 },
    })
    expect(
      screen.queryByRole("dialog", { name: "Nhập cấu hình cơ sở từ Excel" })
    ).not.toBeInTheDocument()
  })

  it("keeps the applied snapshot when dossier revision refresh fails", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    const imported = createDraft({
      revision: 5,
      groups: draft.groups.map((group, index) =>
        index === 0
          ? {
              ...group,
              criteria: [
                {
                  ...group.criteria[0],
                  requirement_text: "Đã nhập nhưng chưa đồng bộ hồ sơ",
                },
              ],
            }
          : group
      ),
    })
    mockVersions([draft])
    rpc.applyImport.mockResolvedValue({ data: imported })
    rpc.getDossier.mockRejectedValue(new Error("network_unavailable"))

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile()] },
    })
    expect(await screen.findByText("TC-0002")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))

    expect(
      await screen.findByText("Đã nhập cấu hình cơ sở nhưng không thể tải lại trạng thái hồ sơ.")
    ).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Đã nhập nhưng chưa đồng bộ hồ sơ")).toBeInTheDocument()
    expect(rpc.applyImport).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole("dialog", { name: "Nhập cấu hình cơ sở từ Excel" })
    ).not.toBeInTheDocument()
  })

  it("preserves stale import state while refreshing history and disabling re-apply", async () => {
    const user = userEvent.setup()
    const queryClient = createPersistentQueryClient()
    const draft = createDraft()
    const refreshed = createDraft({ revision: 6 })
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([draft]))
      .mockResolvedValueOnce(baselineVersionsResponse([refreshed]))
    rpc.applyImport.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )

    renderTab(vi.fn(), queryClient)
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile("stale-baseline.xlsx")] },
    })
    expect(await screen.findByText("TC-0002")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Khóa phiên bản", hidden: true })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))

    expect(
      await within(screen.getByRole("dialog")).findByText(
        "Phiên bản đã thay đổi trên máy chủ. File và bản xem trước vẫn được giữ để đối chiếu."
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("dialog")).getByRole("alert", {
        name: "Lỗi nhập cấu hình cơ sở",
      })
    ).toHaveTextContent(
      "Phiên bản đã thay đổi trên máy chủ. File và bản xem trước vẫn được giữ để đối chiếu."
    )
    expect(screen.getByText("stale-baseline.xlsx")).toBeInTheDocument()
    expect(screen.getByText("TC-0002")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nhập 2 dòng" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Khóa phiên bản", hidden: true })).toBeDisabled()
    await waitFor(() => expect(rpc.listVersions).toHaveBeenCalledTimes(2))
    const cachedVersions = queryClient.getQueryData<TechnicalConfigurationBaselineVersionPages>(
      technicalConfigurationBaselineVersionsQueryKey(dossier.id)
    )
    expect(cachedVersions?.pages[0].data[0]).toEqual(refreshed)
    expect(rpc.applyImport).toHaveBeenCalledTimes(1)
  })

  it("keeps stale import state and reports a failed conflict refresh", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([draft]))
      .mockRejectedValueOnce(new Error("network_unavailable"))
    rpc.applyImport.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile("stale-baseline.xlsx")] },
    })
    expect(await screen.findByText("TC-0002")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))

    expect(
      await within(screen.getByRole("dialog")).findByText(
        "Phiên bản đã thay đổi nhưng không thể tải trạng thái mới. File và bản xem trước vẫn được giữ."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("stale-baseline.xlsx")).toBeInTheDocument()
    expect(screen.getByText("TC-0002")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nhập 2 dòng" })).toBeDisabled()
    expect(rpc.applyImport).toHaveBeenCalledTimes(1)
  })

  it("adopts the refreshed target when dossier refresh fails during conflict recovery", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    const lockedTarget = createLockedVersion({ id: draft.id })
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([draft]))
      .mockResolvedValueOnce(baselineVersionsResponse([lockedTarget]))
    rpc.getDossier.mockRejectedValue(new Error("network_unavailable"))
    rpc.applyImport.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile("locked-target.xlsx")] },
    })
    expect(await screen.findByText("TC-0002")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))

    expect(
      await within(screen.getByRole("dialog")).findByText(
        "Phiên bản đã thay đổi nhưng không thể tải trạng thái mới. File và bản xem trước vẫn được giữ."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nhập từ Excel" })).not.toBeInTheDocument()
    expect(screen.getByText("locked-target.xlsx")).toBeInTheDocument()
  })

  it("keeps stale state targeted to the original version when a replacement draft exists", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    const lockedTarget = createLockedVersion({ id: draft.id })
    const replacementDraft = createDraft({
      id: "draft-2",
      version_number: 2,
      revision: 1,
    })
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([draft]))
      .mockResolvedValueOnce(baselineVersionsResponse([replacementDraft, lockedTarget]))
    rpc.applyImport.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Nhập từ Excel" }))
    fireEvent.change(screen.getByLabelText("Chọn template cấu hình cơ sở"), {
      target: { files: [createBaselineImportFile("locked-target.xlsx")] },
    })
    expect(await screen.findByText("TC-0002")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Nhập 2 dòng" }))

    await waitFor(() => expect(rpc.listVersions).toHaveBeenCalledTimes(2))
    const versionTrigger = screen.getByLabelText("Lịch sử phiên bản")
    expect(versionTrigger.tagName).toBe("BUTTON")
    expect(versionTrigger).toHaveTextContent("Phiên bản 1 · Đã khóa")
    expect(screen.getByText("locked-target.xlsx")).toBeInTheDocument()
    expect(screen.getByText("TC-0002")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nhập 2 dòng" })).toBeDisabled()
  })
})
