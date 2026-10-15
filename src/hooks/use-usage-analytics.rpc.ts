import { callRpc } from "@/lib/rpc-client"
import type { UsageLogQueryOptions, UsageLogWithRelations } from "./use-usage-analytics.types"

/** Fetches regular-dataset usage logs for analytics aggregations. */
export async function fetchUsageLogs(
  options: UsageLogQueryOptions = {}
): Promise<UsageLogWithRelations[]> {
  const payload = await callRpc<UsageLogWithRelations[]>({
    fn: "usage_log_list",
    args: {
      p_thiet_bi_id: options.equipmentId ?? null,
      p_trang_thai: options.status ?? null,
      p_active_only: options.activeOnly ?? false,
      p_started_from: options.startedFrom ? options.startedFrom.toISOString() : null,
      p_started_to: options.startedTo ? options.startedTo.toISOString() : null,
      p_limit: options.limit ?? 2000,
      p_offset: 0,
      p_don_vi: options.donVi ?? null,
      p_equipment_dataset: "regular",
    },
  })

  return payload ?? []
}
