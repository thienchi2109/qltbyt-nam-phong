import { callRpc } from "@/lib/rpc-client"
import type { EquipmentSelectItem } from "./types"

export async function fetchRepairRequestEquipmentList(
  query: string | null,
  pageSize = 20,
) {
  return callRpc<EquipmentSelectItem[]>({
    fn: "equipment_list",
    args: { p_q: query, p_sort: "ten_thiet_bi.asc", p_page: 1, p_page_size: pageSize },
  })
}

export async function fetchRepairRequestEquipmentById(id: number) {
  return callRpc<EquipmentSelectItem | null>({
    fn: "equipment_get",
    args: { p_id: id },
  })
}
