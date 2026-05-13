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

describe("React Doctor P0 mutation invalidation audit", () => {
  it("keeps repair-request mutations wired to the shared invalidation callback", () => {
    const source = readSource(
      "src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx"
    )

    for (const mutation of [
      "useCreateMutation",
      "useUpdateMutation",
      "useDeleteMutation",
      "useApproveMutation",
      "useCompleteMutation",
    ]) {
      expect(source).toContain(`function ${mutation}`)
    }

    expect(source.match(/invalidate\(\)/g)).toHaveLength(5)
    for (const queryKey of [
      "repair_request_list",
      "repair_request_facilities",
      "repair_request_status_counts",
      "repair_request_change_history",
      "dashboard-stats",
    ]) {
      expectInvalidatesQueryKey(source, queryKey)
    }
  })

  it("keeps device-quota category mutations wired to quota query invalidation", () => {
    const source = readSource(
      "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx"
    )

    expect(source.match(/invalidate\(\)/g)).toHaveLength(3)
    for (const queryKey of [
      "dinh_muc_nhom_list",
      "dinh_muc_compliance_summary",
    ]) {
      expectInvalidatesQueryKey(source, queryKey)
    }
  })

  it("keeps device-quota decision mutations wired to decision query invalidation", () => {
    const source = readSource(
      "src/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsContext.tsx"
    )

    expect(source.match(/invalidate\(\)/g)).toHaveLength(4)
    for (const queryKey of [
      "dinh_muc_quyet_dinh_list",
      "dinh_muc_compliance_summary",
    ]) {
      expectInvalidatesQueryKey(source, queryKey)
    }
  })

  it("keeps device-quota mapping mutations wired to unassigned and compliance invalidation", () => {
    const source = readSource(
      "src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx"
    )

    expect(source.match(/invalidate\(\)/g)).toHaveLength(1)
    for (const queryKey of [
      "dinh_muc_thiet_bi_unassigned",
      "dinh_muc_thiet_bi_unassigned_filter_options",
      "dinh_muc_nhom_list",
      "dinh_muc_compliance_summary",
    ]) {
      expectInvalidatesQueryKey(source, queryKey)
    }
  })
})
