import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import * as optionImportRpcManifest from "@/lib/technical-configuration-supplier-option-rpcs"
import type {
  TechnicalConfigurationOptionWorkbookMetadata,
  TechnicalConfigurationOptionWorkbookRow,
} from "@/lib/technical-configuration-option-excel-contract"
import * as optionImportRpcAdapter from "@/app/(app)/technical-configurations/technical-configuration-option-import-rpc"
import type {
  TechnicalConfigurationOptionImportApplyWireResponse,
  TechnicalConfigurationOptionImportPreviewWireResponse,
  TechnicalConfigurationOptionImportRpcArgs,
} from "@/app/(app)/technical-configurations/supplier-option-types"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const MIGRATION_FILE = "20260725060000_technical_configuration_option_import.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_option_import_phase_gate.sql"
)
const LATEST_DEPENDENCY_MIGRATION = "20260723110549_technical_configuration_comparison_set_read.sql"
const VALIDATOR_FUNCTION = "_technical_configuration_option_import_validate"
const PREVIEW_FUNCTION = "technical_configuration_option_import_preview"
const APPLY_FUNCTION = "technical_configuration_option_import_apply"
const { OPTION_IMPORT_RPC_FUNCTION_NAMES, OPTION_IMPORT_RPC_FUNCTIONS } = optionImportRpcManifest
const { applyTechnicalConfigurationOptionImport, previewTechnicalConfigurationOptionImport } =
  optionImportRpcAdapter
const callRpcMock = vi.fn()

vi.mock("@/app/(app)/technical-configurations/technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getFunctionBlock(source: string, functionName: string): string {
  const functions = [
    ...source.matchAll(/^CREATE(?: OR REPLACE)? FUNCTION public\.([a-z0-9_]+)\(/gim),
  ]
  const index = functions.findIndex((match) => match[1] === functionName)
  if (index === -1) return ""

  const start = functions[index].index ?? 0
  const end = functions[index + 1]?.index ?? source.length
  return source.slice(start, end)
}

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const validatorBlock = getFunctionBlock(migrationSource, VALIDATOR_FUNCTION)
const previewBlock = getFunctionBlock(migrationSource, PREVIEW_FUNCTION)
const applyBlock = getFunctionBlock(migrationSource, APPLY_FUNCTION)

describe("P9A2 technical configuration supplier option import migration", () => {
  it("uses one ordered migration after option responses and comparison-set read", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_option_import"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(MIGRATION_FILE.localeCompare(LATEST_DEPENDENCY_MIGRATION)).toBeGreaterThan(0)
  })

  it("freezes the shared validator plus exact secured preview and apply signatures", () => {
    expect(migrationSource).toContain(
      `CREATE OR REPLACE FUNCTION public.${VALIDATOR_FUNCTION}(\n` +
        "  p_option_id UUID,\n" +
        "  p_baseline_version_id UUID,\n" +
        "  p_template_metadata JSONB,\n" +
        "  p_rows JSONB,\n" +
        "  p_expected_revision BIGINT\n" +
        ")"
    )

    for (const functionName of [PREVIEW_FUNCTION, APPLY_FUNCTION]) {
      expect(migrationSource).toContain(
        `CREATE OR REPLACE FUNCTION public.${functionName}(\n` +
          "  p_option_id UUID,\n" +
          "  p_baseline_version_id UUID,\n" +
          "  p_template_metadata JSONB,\n" +
          "  p_rows JSONB,\n" +
          "  p_expected_revision BIGINT\n" +
          ")"
      )
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("RETURNS JSONB")
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(block).toContain(VALIDATOR_FUNCTION)
    }

    expect(validatorBlock).toContain("SECURITY DEFINER")
    expect(validatorBlock).toContain("SET search_path = public, pg_temp")
  })

  it("validates exact target metadata and complete untampered canonical rows", () => {
    for (const key of [
      "template_kind",
      "template_version",
      "dossier_id",
      "option_id",
      "baseline_version_id",
      "dossier_revision",
      "generated_at",
    ]) {
      expect(validatorBlock).toContain(key)
    }

    for (const key of [
      "group_order",
      "group_name",
      "criterion_order",
      "criterion_id",
      "criterion_code",
      "criterion_title",
      "requirement_text",
      "response_text",
      "supplementary_information",
    ]) {
      expect(validatorBlock).toContain(key)
    }

    for (const marker of [
      "technical_configuration_option",
      "template_mismatch",
      "invalid_row_shape",
      "changed_context",
      "missing_criterion",
      "unknown_criterion",
      "duplicate_criterion",
      "row_errors",
    ]) {
      expect(validatorBlock).toContain(marker)
    }
  })

  it("parenthesizes CASE expressions inside PL/pgSQL IF conditions", () => {
    expect(validatorBlock).toMatch(
      /OR \(CASE\s+WHEN v_row->'criterion_title' = 'null'::JSONB THEN NULL\s+ELSE v_row->>'criterion_title'\s+END\) IS DISTINCT FROM/
    )
  })

  it("preloads canonical criteria once before validating imported rows", () => {
    const criteriaLoadMarker = "FROM public.technical_configuration_baseline_criteria c"
    const criteriaLoadIndex = validatorBlock.indexOf(criteriaLoadMarker)
    const rowLoopIndex = validatorBlock.indexOf("FOR v_row, v_row_number IN")

    expect(criteriaLoadIndex).toBeGreaterThanOrEqual(0)
    expect(criteriaLoadIndex).toBeLessThan(rowLoopIndex)
    expect(validatorBlock.split(criteriaLoadMarker)).toHaveLength(2)
    expect(validatorBlock).toContain("jsonb_object_agg")
    expect(validatorBlock).toContain("array_agg")
  })

  it("keeps preview side-effect-free and validates revision without taking the write lock", () => {
    expect(previewBlock).toContain("_technical_configuration_require_global_user")
    expect(previewBlock).not.toContain("_technical_configuration_require_editable_dossier")
    expect(previewBlock).not.toMatch(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./)
    expect(previewBlock).toContain("'errors'")
    expect(previewBlock).toContain("'data'")
    expect(validatorBlock).toMatch(
      /FROM public\.technical_configuration_dossiers d[\s\S]*?FOR SHARE;/
    )
  })

  it("locks and revalidates before the first apply mutation", () => {
    const lockIndex = applyBlock.indexOf("_technical_configuration_require_editable_dossier")
    const validationIndex = applyBlock.indexOf(VALIDATOR_FUNCTION)
    const mutationIndex = applyBlock.search(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./)

    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(validationIndex).toBeGreaterThan(lockIndex)
    expect(mutationIndex).toBeGreaterThan(validationIndex)
    expect(applyBlock).toContain("technical_configuration_comparison_sets")
    expect(applyBlock).toContain("technical_configuration_option_responses")
    expect(applyBlock).toContain("revision = revision + 1")
  })

  it("reconciles the full response snapshot and deletes canonical blank rows", () => {
    expect(applyBlock).toMatch(/INSERT INTO public\.technical_configuration_comparison_sets/)
    expect(applyBlock).toMatch(/INSERT INTO public\.technical_configuration_option_responses/)
    expect(applyBlock).toMatch(/UPDATE public\.technical_configuration_option_responses/)
    expect(applyBlock).toMatch(/DELETE FROM public\.technical_configuration_option_responses/)
    expect(applyBlock).toMatch(/row->>'response_text'\s*=\s*''/)
    expect(applyBlock).toMatch(/row->>'supplementary_information'\s*=\s*''/)
  })

  it("keeps the helper private and exposes only preview/apply through explicit grants", () => {
    const helperSignature = `${VALIDATOR_FUNCTION}(UUID, UUID, JSONB, JSONB, BIGINT)`
    const rpcSignatures = [
      `${PREVIEW_FUNCTION}(UUID, UUID, JSONB, JSONB, BIGINT)`,
      `${APPLY_FUNCTION}(UUID, UUID, JSONB, JSONB, BIGINT)`,
    ]

    expect(migrationSource).toContain(
      `REVOKE ALL ON FUNCTION public.${helperSignature} FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(migrationSource).toContain(
      `GRANT EXECUTE ON FUNCTION public.${helperSignature} TO service_role;`
    )

    for (const signature of rpcSignatures) {
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated, service_role;`
      )
    }
  })

  it("ships a rollback-only phase gate for trust, stale zero-write and atomicity", () => {
    expect(phaseGateSource).not.toMatch(/^\\i[r]?\b/m)

    for (const marker of [
      "BEGIN;",
      "ROLLBACK;",
      "raw admin preview succeeds",
      "global apply succeeds",
      "missing claims fail closed",
      "invalid claims fail closed",
      "non-global role denied",
      "preview is read-only",
      "preview issue",
      "wrong option metadata zero writes",
      "wrong baseline metadata zero writes",
      "malformed rows zero writes",
      "tampered rows zero writes",
      "missing criterion zero writes",
      "unknown criterion zero writes",
      "duplicate criterion zero writes",
      "stale preview zero writes",
      "stale apply zero writes",
      "archived target zero writes",
      "creates comparison set inside apply",
      "reconciles complete snapshot",
      "blank canonical row deletes response",
      "increments dossier revision exactly once",
      "late failure rolls back comparison set and responses",
      "CREATE TRIGGER technical_configuration_option_import_fail_revision",
      "injected_late_failure",
      "draft baseline accepted",
      "locked baseline accepted",
      PREVIEW_FUNCTION,
      APPLY_FUNCTION,
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
  })
})

describe("P9A2 atomic supplier option import RPC contract", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("freezes exactly the preview and apply RPC names", () => {
    expect(OPTION_IMPORT_RPC_FUNCTIONS).toEqual({
      previewOptionImport: "technical_configuration_option_import_preview",
      applyOptionImport: "technical_configuration_option_import_apply",
    })
    expect(OPTION_IMPORT_RPC_FUNCTION_NAMES).toEqual(Object.values(OPTION_IMPORT_RPC_FUNCTIONS))
  })

  it("delegates canonical metadata and rows without remapping transient import state", async () => {
    const metadata: TechnicalConfigurationOptionWorkbookMetadata = {
      template_kind: "technical_configuration_option",
      template_version: 1,
      dossier_id: "00000000-0000-0000-0000-000000000001",
      option_id: "00000000-0000-0000-0000-000000000003",
      baseline_version_id: "00000000-0000-0000-0000-000000000005",
      dossier_revision: 7,
      generated_at: "2026-07-25T00:00:00.000Z",
    }
    const rows: TechnicalConfigurationOptionWorkbookRow[] = [
      {
        group_order: 1,
        group_name: "Yêu cầu kỹ thuật",
        criterion_order: 1,
        criterion_id: "00000000-0000-0000-0000-000000000006",
        criterion_code: "TC-0001",
        criterion_title: "Nguồn điện",
        requirement_text: "Điện áp 220 V",
        response_text: "Đáp ứng",
        supplementary_information: "",
      },
    ]
    const args: TechnicalConfigurationOptionImportRpcArgs = {
      p_option_id: metadata.option_id,
      p_baseline_version_id: metadata.baseline_version_id,
      p_template_metadata: metadata,
      p_rows: rows,
      p_expected_revision: metadata.dossier_revision,
    }
    const previewResponse: TechnicalConfigurationOptionImportPreviewWireResponse = {
      data: { metadata, rows },
      errors: [],
    }
    const applyResponse: TechnicalConfigurationOptionImportApplyWireResponse = {
      data: {
        id: "00000000-0000-0000-0000-000000000004",
        dossier_id: metadata.dossier_id,
        option_id: metadata.option_id,
        baseline_version_id: metadata.baseline_version_id,
        created_at: "2026-07-25T00:00:00.000Z",
        created_by: 1,
        updated_at: "2026-07-25T00:01:00.000Z",
        updated_by: 1,
        revision: 8,
        responses: [],
      },
    }
    const signal = new AbortController().signal
    callRpcMock.mockResolvedValueOnce(previewResponse).mockResolvedValueOnce(applyResponse)

    await expect(previewTechnicalConfigurationOptionImport(args, signal)).resolves.toEqual(
      previewResponse
    )
    await expect(applyTechnicalConfigurationOptionImport(args)).resolves.toEqual(applyResponse)

    expect(callRpcMock.mock.calls).toEqual([
      [OPTION_IMPORT_RPC_FUNCTIONS.previewOptionImport, args, { signal }],
      [OPTION_IMPORT_RPC_FUNCTIONS.applyOptionImport, args, { signal: undefined }],
    ])
  })
})
