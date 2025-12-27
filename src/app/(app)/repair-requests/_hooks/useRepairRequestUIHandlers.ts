import type { RepairRequestWithEquipment } from "../types"
import { buildRepairRequestSheetHtml } from "../request-sheet"

/** External dependencies for UI handlers */
export interface UIHandlersDeps {
  branding: { name?: string | null; logo_url?: string | null } | null | undefined
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>['toast']
}

/** Returned UI handlers */
export interface UIHandlersActions {
  /** Generate and open repair request sheet in new window */
  handleGenerateRequestSheet: (request: RepairRequestWithEquipment) => void
}

/**
 * Hook for repair request UI handlers (sheet generation, etc.)
 *
 * @param deps - External dependencies (branding, toast)
 * @returns UI handlers
 */
export function useRepairRequestUIHandlers(
  deps: UIHandlersDeps
): UIHandlersActions {
  const { branding, toast } = deps

  const handleGenerateRequestSheet = (request: RepairRequestWithEquipment): void => {
    const organizationName = branding?.name || "TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ"
    const logoUrl =
      branding?.logo_url ||
      "https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png"

    try {
      const htmlContent = buildRepairRequestSheetHtml(request, {
        organizationName,
        logoUrl,
      })

      const newWindow = window.open("", "_blank")
      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(htmlContent)
        newWindow.document.close()
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tạo phiếu yêu cầu.",
      })
    }
  }

  return { handleGenerateRequestSheet }
}
