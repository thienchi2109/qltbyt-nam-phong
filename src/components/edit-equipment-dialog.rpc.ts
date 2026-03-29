import { callRpc } from "@/lib/rpc-client"

export async function updateEquipmentRecord<TPatch extends Record<string, unknown>>(
  id: number,
  patch: TPatch,
): Promise<void> {
  await callRpc<boolean>({
    fn: "equipment_update",
    args: { p_id: id, p_patch: patch },
  })
}
