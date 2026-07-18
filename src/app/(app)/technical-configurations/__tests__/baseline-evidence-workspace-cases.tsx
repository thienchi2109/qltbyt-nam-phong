import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, type Mock } from "vitest"

import { TechnicalConfigurationBaselineEvidence } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEvidence"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { baselineVersion, type DocumentRpcMocks } from "./baseline-evidence-fixtures"

type BaselineRpcMocks = {
  listVersions: Mock
}

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-18T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-18T00:00:00.000Z",
  updated_by: 1,
}

export function registerBaselineEvidenceWorkspaceTests({
  baselineRpc,
  documentRpc,
}: {
  baselineRpc: BaselineRpcMocks
  documentRpc: DocumentRpcMocks
}) {
  describe("TechnicalConfigurationBaselineEvidence workspace", () => {
    it("selects the current baseline and composes its evidence owner", async () => {
      baselineRpc.listVersions.mockResolvedValue({
        data: [baselineVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      documentRpc.listDocuments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 100,
      })

      render(<TechnicalConfigurationBaselineEvidence dossier={dossier} />, {
        wrapper: createReactQueryWrapper(createTestQueryClient()),
      })

      expect(
        await screen.findByRole("heading", { name: "Tài liệu và trích dẫn" })
      ).toBeInTheDocument()
      await waitFor(() =>
        expect(documentRpc.listDocuments).toHaveBeenCalledWith(
          {
            p_baseline_version_id: baselineVersion.id,
            p_page: 1,
            p_page_size: 100,
          },
          expect.any(AbortSignal)
        )
      )
    })

    it("registers beforeunload protection while an evidence draft is dirty", async () => {
      const user = userEvent.setup()
      const addEventListener = vi.spyOn(window, "addEventListener")
      baselineRpc.listVersions.mockResolvedValue({
        data: [baselineVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      documentRpc.listDocuments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 100,
      })

      render(<TechnicalConfigurationBaselineEvidence dossier={dossier} />, {
        wrapper: createReactQueryWrapper(createTestQueryClient()),
      })

      await user.type(await screen.findByLabelText("Tên tài liệu"), "Hồ sơ chưa lưu")
      const beforeUnloadHandler = addEventListener.mock.calls.find(
        ([eventName]) => eventName === "beforeunload"
      )?.[1]
      expect(beforeUnloadHandler).toBeTypeOf("function")
      const dirtyEvent = new Event("beforeunload", { cancelable: true })
      ;(beforeUnloadHandler as EventListener)(dirtyEvent)

      expect(dirtyEvent.defaultPrevented).toBe(true)
      addEventListener.mockRestore()
    })

    it("propagates archived dossier read-only state to evidence controls", async () => {
      baselineRpc.listVersions.mockResolvedValue({
        data: [baselineVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      documentRpc.listDocuments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 100,
      })

      render(
        <TechnicalConfigurationBaselineEvidence
          dossier={{
            ...dossier,
            archived_at: "2026-07-18T00:00:00.000Z",
            archived_by: 1,
          }}
        />,
        { wrapper: createReactQueryWrapper(createTestQueryClient()) }
      )

      expect(await screen.findByLabelText("Tên tài liệu")).toBeDisabled()
      expect(screen.getByRole("button", { name: "Thêm tài liệu" })).toBeDisabled()
    })
  })
}
