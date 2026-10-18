"use client"

import { callRpc } from "@/lib/rpc-client"
import { fetchTemperatureTrendPages } from "@/lib/temperature-trend"
import type { TemperatureSlot, TemperatureWorkspace } from "@/types/temperature-monitoring"
import { useTemperatureQuery } from "@/hooks/use-temperature-monitoring"

/** Load every bounded workspace page for one equipment and the selected history filters. */
export function useTemperatureTrend(args: Record<string, unknown>, enabled = true) {
  const pageArgs = { ...args, p_cursor: null, p_limit: 200 }
  const equipment = args.p_equipment_id
  const hasEquipment =
    typeof equipment === "number" && Number.isSafeInteger(equipment) && equipment > 0

  return useTemperatureQuery<TemperatureSlot[]>(
    "temperature_monitoring_workspace_list",
    pageArgs,
    enabled && hasEquipment,
    (signal) =>
      fetchTemperatureTrendPages(
        (requestArgs, requestSignal) =>
          callRpc<TemperatureWorkspace>({
            fn: "temperature_monitoring_workspace_list",
            args: requestArgs,
            signal: requestSignal ?? signal,
          }),
        pageArgs,
        signal
      ),
    "trend-all-pages"
  )
}
