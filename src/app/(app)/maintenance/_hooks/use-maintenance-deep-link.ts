import * as React from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { findMaintenancePlanById } from "../_components/maintenance-plan-lookup"

interface UseMaintenanceDeepLinkOptions {
  /** Current list of plans from the paginated query */
  plans: MaintenancePlan[]
  /** Whether plans are still loading */
  isLoadingPlans: boolean
  /** Open the "create plan" dialog */
  setIsAddPlanDialogOpen: (open: boolean) => void
  /** Select a plan (navigates context to that plan) */
  setSelectedPlan: (plan: MaintenancePlan) => void
  /** Switch the active tab */
  setActiveTab: (tab: string) => void
}

/**
 * Handles URL deep-link resolution for the Maintenance page.
 *
 * Supported query params:
 *  - `action=create` → opens the "create plan" dialog
 *  - `planId=<number>` → selects the plan (optionally with `tab=tasks`)
 *
 * Uses a ref guard (`lastHandledKeyRef`) to ensure each unique URL is
 * processed exactly once, preventing re-render loops when deps like
 * `plans` or `isLoadingPlans` change.
 */
export function useMaintenanceDeepLink({
  plans,
  isLoadingPlans,
  setIsAddPlanDialogOpen,
  setSelectedPlan,
  setActiveTab,
}: UseMaintenanceDeepLinkOptions) {
  const searchParams = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const lastHandledKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let isCancelled = false

    const resolveDeepLink = async () => {
      if (lastHandledKeyRef.current === searchParamsKey) {
        return
      }

      const params = new URLSearchParams(searchParamsKey)
      const planIdParam = params.get("planId")
      const tabParam = params.get("tab")
      const actionParam = params.get("action")

      if (actionParam === "create") {
        lastHandledKeyRef.current = searchParamsKey
        setIsAddPlanDialogOpen(true)
        router.replace(pathname, { scroll: false })
        return
      }

      if (!planIdParam) {
        lastHandledKeyRef.current = searchParamsKey
        return
      }

      // Wait for plans to finish loading before attempting lookup
      if (isLoadingPlans) return

      const planId = Number.parseInt(planIdParam, 10)
      if (!Number.isFinite(planId)) {
        lastHandledKeyRef.current = searchParamsKey
        toast({
          variant: "destructive",
          title: "Không tìm thấy kế hoạch",
          description: `Kế hoạch #${planIdParam} không hợp lệ.`,
        })
        router.replace(pathname, { scroll: false })
        return
      }

      let targetPlan = plans.find((plan) => plan.id === planId)

      if (!targetPlan) {
        try {
          targetPlan = await findMaintenancePlanById(planId) ?? undefined
        } catch (error) {
          console.error("[Maintenance] Deep link plan lookup failed:", error)
        }
      }

      if (isCancelled) {
        return
      }

      lastHandledKeyRef.current = searchParamsKey
      if (targetPlan) {
        setSelectedPlan(targetPlan)
        if (tabParam === "tasks") {
          setActiveTab("tasks")
        }
      } else {
        toast({
          variant: "destructive",
          title: "Không tìm thấy kế hoạch",
          description: `Kế hoạch #${planId} không tồn tại hoặc bạn không có quyền truy cập.`,
        })
      }
      router.replace(pathname, { scroll: false })
    }

    void resolveDeepLink()

    return () => {
      isCancelled = true
    }
  }, [
    searchParamsKey,
    plans,
    isLoadingPlans,
    setIsAddPlanDialogOpen,
    setSelectedPlan,
    setActiveTab,
    toast,
    router,
    pathname,
  ])
}
