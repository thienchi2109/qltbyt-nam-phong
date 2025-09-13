"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QrCode, ArrowLeft, Camera, Smartphone } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import type { Equipment } from "@/lib/data"

// Dynamic imports to avoid SSR issues with camera components
const QRScannerCamera = dynamic(
  () => import("@/components/qr-scanner-camera").then(mod => ({ default: mod.QRScannerCamera })),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen">Đang tải camera...</div>
  }
)

const QRActionSheet = dynamic(
  () => import("@/components/qr-action-sheet").then(mod => ({ default: mod.QRActionSheet })),
  { 
    ssr: false,
    loading: () => <div>Đang tải...</div>
  }
)

const EditEquipmentDialog = dynamic(
  () => import("@/components/edit-equipment-dialog").then(mod => ({ default: mod.EditEquipmentDialog })),
  { ssr: false }
)

export default function QRScannerPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isCameraActive, setIsCameraActive] = React.useState(false)
  const [scannedCode, setScannedCode] = React.useState<string>("")
  const [showActionSheet, setShowActionSheet] = React.useState(false)
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | null>(null)

  const handleStartScanning = () => {
    // Check if we're in browser environment
    if (typeof window === "undefined") {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Chức năng này chỉ hoạt động trên trình duyệt."
      })
      return
    }

    // Check if camera is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: "Camera không được hỗ trợ",
        description: "Trình duyệt của bạn không hỗ trợ chức năng camera."
      })
      return
    }

    setIsCameraActive(true)
  }

  const handleScanSuccess = (result: string) => {
    setScannedCode(result)
    setIsCameraActive(false)
    setShowActionSheet(true)
    
    toast({
      title: "Quét thành công!",
      description: `Đã quét mã: ${result}`,
      duration: 3000,
    })
  }

  const handleCloseCamera = () => {
    setIsCameraActive(false)
  }

  const handleAction = (action: string, equipment?: Equipment) => {
    setShowActionSheet(false)

    try {
      switch (action) {
        case 'usage-log':
          if (equipment) {
            router.push(`/equipment?highlight=${equipment.id}&tab=usage`)
          }
          break
          
        case 'view-details':
          if (equipment) {
            router.push(`/equipment?highlight=${equipment.id}`)
          }
          break
          
        case 'view-history':
          if (equipment) {
            router.push(`/equipment?highlight=${equipment.id}&tab=history`)
          }
          break
          
        case 'create-repair':
          if (equipment) {
            router.push(`/repair-requests?equipmentId=${equipment.id}`)
          }
          break
          
        case 'update-status':
          if (equipment) {
            setEditingEquipment(equipment)
          }
          break
          
        default:
          toast({
            variant: "destructive",
            title: "Hành động không hợp lệ",
            description: "Vui lòng thử lại."
          })
      }
    } catch (error) {
      console.error("Navigation error:", error)
      toast({
        variant: "destructive",
        title: "Lỗi điều hướng",
        description: "Không thể chuyển đến trang yêu cầu."
      })
    }
  }

  const handleCloseActionSheet = () => {
    setShowActionSheet(false)
    setScannedCode("")
  }

  return (
    <>
      {/* Camera Scanner */}
      {isCameraActive && (
        <QRScannerCamera
          onScanSuccess={handleScanSuccess}
          onClose={handleCloseCamera}
          isActive={isCameraActive}
        />
      )}

      {/* Action Sheet */}
      {showActionSheet && scannedCode && (
        <QRActionSheet
          qrCode={scannedCode}
          onClose={handleCloseActionSheet}
          onAction={handleAction}
        />
      )}

      {/* Edit Equipment Dialog */}
      {editingEquipment && (
        <EditEquipmentDialog
          open={!!editingEquipment}
          onOpenChange={(open) => {
            if (!open) {
              setEditingEquipment(null)
            }
          }}
          onSuccess={() => {
            setEditingEquipment(null)
            toast({
              title: "Thành công",
              description: "Đã cập nhật thông tin thiết bị."
            })
          }}
          equipment={editingEquipment}
        />
      )}

      {/* Main Content */}
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <QrCode className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="heading-responsive-h2">Quét mã QR thiết bị</CardTitle>
              <CardDescription className="body-responsive">
                Quét mã QR để truy cập nhanh thông tin thiết bị y tế
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 mobile-card-spacing">
              <div className="text-center">
                <div className="mb-6">
                  <Button
                    size="lg"
                    onClick={handleStartScanning}
                    className="h-14 px-8 text-lg touch-target-lg"
                  >
                    <Camera className="h-6 w-6 mr-3" />
                    <span className="button-text-responsive">Bắt đầu quét</span>
                  </Button>
                </div>

                <div className="space-y-6 mobile-card-spacing">
                  <h3 className="heading-responsive-h3 font-semibold mb-4">Chức năng có sẵn</h3>
                  <div className="grid gap-4 text-left">
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Ghi nhật ký sử dụng thiết bị:</strong>
                        <p className="caption-responsive">
                          Theo dõi và ghi nhận quá trình sử dụng thiết bị trực tiếp
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Xem thông tin chi tiết:</strong>
                        <p className="caption-responsive">
                          Truy cập đầy đủ thông tin kỹ thuật và vị trí thiết bị
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Lịch sử bảo trì & sửa chữa:</strong>
                        <p className="caption-responsive">
                          Theo dõi toàn bộ lịch sử hoạt động và bảo trì thiết bị
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Tạo yêu cầu sửa chữa:</strong>
                        <p className="text-sm text-muted-foreground">
                          Báo cáo sự cố và tạo yêu cầu sửa chữa ngay lập tức
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Cập nhật trạng thái:</strong>
                        <p className="text-sm text-muted-foreground">
                          Chỉnh sửa thông tin và trạng thái thiết bị nhanh chóng
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      Hướng dẫn sử dụng
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                      <li>• Nhấn "Bắt đầu quét" để mở camera</li>
                      <li>• Đưa mã QR vào khung quét trên màn hình</li>
                      <li>• Chờ hệ thống tự động nhận diện mã</li>
                      <li>• Chọn hành động muốn thực hiện</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="text-center pt-4">
                <Button asChild variant="outline" className="touch-target">
                  <Link href="/dashboard">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Về Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
