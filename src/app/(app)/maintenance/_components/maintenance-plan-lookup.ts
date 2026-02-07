import { callRpc } from "@/lib/rpc-client"
import type {
  MaintenancePlan,
  MaintenancePlanListResponse,
} from "@/hooks/use-cached-maintenance"

const PLAN_LOOKUP_PAGE_SIZE = 200

function normalizePlan(plan: MaintenancePlan): MaintenancePlan {
  return {
    ...plan,
    don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi,
  }
}

export async function findMaintenancePlanById(planId: number): Promise<MaintenancePlan | null> {
  let page = 1

  while (true) {
    const result = await callRpc<MaintenancePlanListResponse>({
      fn: "maintenance_plan_list",
      args: {
        p_q: null,
        p_don_vi: null,
        p_page: page,
        p_page_size: PLAN_LOOKUP_PAGE_SIZE,
      },
    })

    const pagePlans = (result.data ?? []).map((plan) => normalizePlan(plan))
    const targetPlan = pagePlans.find((plan) => plan.id === planId)
    if (targetPlan) {
      return targetPlan
    }

    const totalPages = Math.ceil((result.total ?? 0) / PLAN_LOOKUP_PAGE_SIZE)
    if (totalPages === 0 || page >= totalPages) {
      return null
    }

    page += 1
  }
}
