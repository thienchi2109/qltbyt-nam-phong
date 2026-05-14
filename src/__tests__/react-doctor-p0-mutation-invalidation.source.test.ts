import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const readSource = (file: string) =>
  readFileSync(join(process.cwd(), file), "utf8")

const expectInvalidatesQueryKey = (source: string, queryKey: string) => {
  expect(source).toMatch(
    new RegExp(
      String.raw`invalidateQueries\(\{\s*queryKey:\s*\[["']${queryKey}["']\]`
    )
  )
}

const extractFunctionSource = (source: string, functionName: string) => {
  const functionPattern = new RegExp(
    String.raw`(?:export\s+)?function\s+${functionName}\b`
  )
  const match = functionPattern.exec(source)
  expect(match?.index, `${functionName} should exist`).toBeGreaterThanOrEqual(0)

  const start = match?.index ?? 0
  const nextFunctionOffset = source
    .slice(start + 1)
    .search(/\n(?:export\s+)?function\s+/)

  return source.slice(
    start,
    nextFunctionOffset === -1 ? undefined : start + 1 + nextFunctionOffset
  )
}

const expectMutationOwnsInvalidation = (
  source: string,
  functionName: string,
  queryKeys: string[],
  extraAssertions: Array<(functionSource: string) => void> = []
) => {
  const functionSource = extractFunctionSource(source, functionName)

  expect(functionSource).toContain("queryClient.invalidateQueries")
  expect(functionSource).not.toContain("invalidate()")

  for (const queryKey of queryKeys) {
    expectInvalidatesQueryKey(functionSource, queryKey)
  }

  for (const assertion of extraAssertions) {
    assertion(functionSource)
  }
}

const expectInvalidatesRepairKeysAll = (functionSource: string) => {
  expect(functionSource).toContain(
    "queryClient.invalidateQueries({ queryKey: repairKeys.all })"
  )
}

describe("React Doctor P0 mutation invalidation audit", () => {
  it("keeps repair-request mutations owning their affected query invalidation", () => {
    const source = readSource(
      "src/app/(app)/repair-requests/_components/RepairRequestsMutations.ts"
    )

    const queryKeys = [
      "repair_request_list",
      "repair_request_facilities",
      "repair_request_status_counts",
      "repair_request_change_history",
      "dashboard-stats",
    ]

    for (const mutation of [
      "useCreateMutation",
      "useUpdateMutation",
      "useDeleteMutation",
      "useApproveMutation",
      "useCompleteMutation",
    ]) {
      expectMutationOwnsInvalidation(source, mutation, queryKeys, [
        expectInvalidatesRepairKeysAll,
      ])
    }
  })

  it("keeps device-quota category mutations wired to quota query invalidation", () => {
    const source = readSource(
      "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryMutations.ts"
    )

    const queryKeys = [
      "dinh_muc_nhom_list",
      "dinh_muc_compliance_summary",
    ]

    for (const mutation of [
      "useCreateMutation",
      "useUpdateMutation",
      "useDeleteMutation",
    ]) {
      expectMutationOwnsInvalidation(source, mutation, queryKeys)
    }
  })

  it("keeps device-quota decision mutations wired to decision query invalidation", () => {
    const source = readSource(
      "src/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionMutations.ts"
    )

    const queryKeys = [
      "dinh_muc_quyet_dinh_list",
      "dinh_muc_compliance_summary",
    ]

    for (const mutation of [
      "useCreateMutation",
      "useUpdateMutation",
      "useActivateMutation",
      "useDeleteMutation",
    ]) {
      expectMutationOwnsInvalidation(source, mutation, queryKeys)
    }
  })

  it("keeps device-quota mapping mutations wired to unassigned and compliance invalidation", () => {
    const source = readSource(
      "src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingMutations.ts"
    )

    expectMutationOwnsInvalidation(source, "useLinkEquipmentMutation", [
      "dinh_muc_thiet_bi_unassigned",
      "dinh_muc_thiet_bi_unassigned_filter_options",
      "dinh_muc_nhom_list",
      "dinh_muc_compliance_summary",
    ])
  })
})
