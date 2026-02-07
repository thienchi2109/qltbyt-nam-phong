"use client"

import * as React from "react"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import { buildPrintTemplate } from "./maintenance-print-template"

interface UseMaintenancePrintParams {
  selectedPlan: MaintenancePlan | null
  tasks: MaintenanceTask[]
  user: { full_name?: string | null } | null
}

export function useMaintenancePrint({
  selectedPlan,
  tasks,
  user,
}: UseMaintenancePrintParams) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = React.useState(false)

  const generatePlanForm = React.useCallback(async () => {
    if (!selectedPlan || tasks.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Vui lòng đảm bảo kế hoạch đã có thiết bị và đã được lưu vào database.",
      })
      return
    }

    setIsGenerating(true)

    const newWindow = window.open("", "_blank")
    if (!newWindow) {
      toast({
        variant: "destructive",
        title: "Không thể mở cửa sổ in",
        description: "Trình duyệt đã chặn popup. Vui lòng bật popup cho trang này và thử lại.",
      })
      setIsGenerating(false)
      return
    }

    newWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Đang tải...</title></head>
      <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8f9fa;">
        <div style="text-align: center;">
          <div style="width: 32px; height: 32px; border: 4px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
          <p style="color: #6b7280; margin: 0;">Đang tải kế hoạch...</p>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      </body></html>
    `)

    let tenantBranding: { logo_url?: string | null; name?: string | null } | null = null
    try {
      const brandingResult = await callRpc<Array<{ logo_url?: string | null; name?: string | null }>>({
        fn: "don_vi_branding_get",
        args: { p_id: null },
      })
      tenantBranding = Array.isArray(brandingResult) ? brandingResult[0] : null
    } catch (error) {
      console.error("Failed to fetch tenant branding:", error)
    }

    const logoUrl = tenantBranding?.logo_url || "https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo"
    const organizationName = tenantBranding?.name || "Nền tảng QLTBYT"

    if (newWindow.closed) {
      toast({
        variant: "destructive",
        title: "Cửa sổ in đã bị đóng",
        description: "Vui lòng thử lại và không đóng cửa sổ trong quá trình tải.",
      })
      setIsGenerating(false)
      return
    }

    const htmlContent = buildPrintTemplate({
      selectedPlan,
      tasks,
      user,
      logoUrl,
      organizationName,
    })

    newWindow.document.open()
    newWindow.document.write(htmlContent)
    newWindow.document.close()

    setIsGenerating(false)
  }, [selectedPlan, tasks, toast, user])

  return {
    generatePlanForm,
    isGenerating,
  }
}
