/**
 * useQRScanner.ts
 *
 * Encapsulates QR scanner state management: camera activation,
 * scan result handling, and action sheet lifecycle.
 * Extracted from equipment-toolbar.tsx to meet single-responsibility.
 */

"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import type { Equipment } from "@/types/database"

export function useQRScanner() {
  const { toast } = useToast()
  const [isCameraActive, setIsCameraActive] = React.useState(false)
  const [scannedCode, setScannedCode] = React.useState("")
  const [showActionSheet, setShowActionSheet] = React.useState(false)

  const handleStartScanning = React.useCallback(() => {
    if (typeof window === "undefined") {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Chức năng này chỉ hoạt động trên trình duyệt.",
      })
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: "Camera không được hỗ trợ",
        description: "Trình duyệt của bạn không hỗ trợ chức năng camera.",
      })
      return
    }

    setIsCameraActive(true)
  }, [toast])

  const handleScanSuccess = React.useCallback(
    (result: string) => {
      setScannedCode(result)
      setIsCameraActive(false)
      setShowActionSheet(true)
      toast({
        title: "Quét thành công!",
        description: `Đã quét mã: ${result}`,
        duration: 3000,
      })
    },
    [toast]
  )

  const handleCloseCamera = React.useCallback(() => {
    setIsCameraActive(false)
  }, [])

  const handleCloseActionSheet = React.useCallback(() => {
    setShowActionSheet(false)
    setScannedCode("")
  }, [])

  const handleAction = React.useCallback(
    (
      action: string,
      equipment?: Equipment,
      onShowEquipmentDetails?: (eq: Equipment) => void
    ) => {
      setShowActionSheet(false)
      setScannedCode("")
      if (action === "view-details" && equipment && onShowEquipmentDetails) {
        onShowEquipmentDetails(equipment)
      }
    },
    []
  )

  return {
    isCameraActive,
    scannedCode,
    showActionSheet,
    handleStartScanning,
    handleScanSuccess,
    handleCloseCamera,
    handleCloseActionSheet,
    handleAction,
  }
}
