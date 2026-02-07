import { callRpc } from "@/lib/rpc-client"
import type {
  MaintenancePlan,
} from "@/hooks/use-cached-maintenance"

function normalizePlan(plan: MaintenancePlan): MaintenancePlan {
  return {
    ...plan,
    don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi,
  }
}

export async function findMaintenancePlanById(planId: number): Promise<MaintenancePlan | null> {
  const result = await callRpc<MaintenancePlan | null>({
    fn: "maintenance_plan_get",
    args: { p_id: planId },
  })

  if (!result) {
    return null
  }

  return normalizePlan(result)
}
