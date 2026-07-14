import { renderHook } from "@testing-library/react"
import { vi } from "vitest"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

const rpc = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getDossier: vi.fn(),
  getDraft: vi.fn(),
  listVersions: vi.fn(),
  lockVersion: vi.fn(),
  copyVersion: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => rpc,
}))

export const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

export const draft: TechnicalConfigurationBaselineDraftWire = {
  id: "draft-1",
  dossier_id: "dossier-1",
  version_number: 1,
  status: "draft",
  source_baseline_version_id: null,
  source_version_number: null,
  next_criterion_number: 2,
  revision: 4,
  locked_at: null,
  locked_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
  groups: [
    {
      id: "group-1",
      baseline_version_id: "draft-1",
      name: "Yêu cầu chung",
      sort_order: 1,
      created_at: "2026-07-13T00:00:00.000Z",
      created_by: 1,
      updated_at: "2026-07-13T00:00:00.000Z",
      updated_by: 1,
      criteria: [
        {
          id: "criterion-1",
          baseline_version_id: "draft-1",
          group_id: "group-1",
          criterion_code: "TC-0001",
          title: null,
          requirement_text: "Nguồn điện ổn định",
          sort_order: 1,
          source_criterion_id: null,
          created_at: "2026-07-13T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-13T00:00:00.000Z",
          updated_by: 1,
        },
      ],
    },
  ],
}

export function getBaselineEditorRpcMock() {
  return rpc
}

/** Renders the baseline editor hook with an isolated query client. */
export function renderBaselineEditor(isExternalDraftReplacementBlocked = false) {
  return renderHook(
    ({ replacementBlocked }: { replacementBlocked: boolean }) =>
      useTechnicalConfigurationBaselineEditor({
        dossier,
        isExternalDraftReplacementBlocked: replacementBlocked,
      }),
    {
      initialProps: { replacementBlocked: isExternalDraftReplacementBlocked },
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    }
  )
}
