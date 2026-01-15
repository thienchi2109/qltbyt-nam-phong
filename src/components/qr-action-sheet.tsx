"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Eye, History, Wrench, Settings, X, Search, ClipboardList, AlertCircle, RotateCcw } from "lucide-react"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { Equipment } from "@/lib/data"

interface QRActionSheetProps {
  qrCode: string // Mã thiết bị từ QR code
  onClose: () => void
  onAction: (action: string, equipment?: Equipment) => void
}

export function QRActionSheet({ qrCode, onClose, onAction }: QRActionSheetProps) {
  const [equipment, setEquipment] = React.useState<Equipment | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [errorType, setErrorType] = React.useState<'not_found' | 'access_denied' | 'network' | null>(null)
  const { toast } = useToast()

  // Tìm kiếm thiết bị theo mã thiết bị
  const searchEquipment = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setErrorType(null)

      // Use dedicated RPC for exact ma_thiet_bi lookup with tenant security
      const normalizedCode = qrCode.trim()
      const result = await callRpc<any>({
        fn: 'equipment_get_by_code',
        args: { p_ma_thiet_bi: normalizedCode }
      })

      if (!result) {
        setError(`Không tìm thấy thiết bị với mã "${qrCode}" trong hệ thống`)
        setErrorType('not_found')
        setEquipment(null)
      } else {
        setEquipment(result)
      }
    } catch (err: any) {
      // Parse RPC error response
      const errorMsg = err?.message || ''

      // Determine error type for better Vietnamese messaging
      if (errorMsg.includes('access denied') || errorMsg.includes('42501')) {
        setError(`Thiết bị với mã "${qrCode}" không thuộc quyền quản lý của bạn`)
        setErrorType('access_denied')
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch') || errorMsg.includes('Network request failed')) {
        setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.')
        setErrorType('network')
      } else if (errorMsg.includes('not found')) {
        setError(`Không tìm thấy thiết bị với mã "${qrCode}" trong hệ thống`)
        setErrorType('not_found')
      } else {
        setError(`Đã có lỗi xảy ra khi tìm kiếm thiết bị: ${errorMsg}`)
        setErrorType('not_found')
      }
      setEquipment(null)
    } finally {
      setLoading(false)
    }
  }, [qrCode])

  React.useEffect(() => {
    if (qrCode) {
      searchEquipment()
    }
  }, [qrCode, searchEquipment])

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "Hoạt động":
        return "bg-green-100 text-green-800 border-green-200"
      case "Chờ sửa chữa":
        return "bg-red-100 text-red-800 border-red-200"
      case "Chờ bảo trì":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Chờ hiệu chuẩn/kiểm định":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "Ngưng sử dụng":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "Chưa có nhu cầu sử dụng":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount)
  }

  const handleActionClick = (action: string) => {
    if (equipment) {
      onAction(action, equipment)
    } else {
      toast({
        variant: "destructive",
        title: "Không thể thực hiện",
        description: "Không tìm thấy thông tin thiết bị"
      })
    }
  }

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              <SheetTitle>Kết quả quét QR</SheetTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Mã thiết bị đã quét:</p>
            <p className="font-mono font-semibold text-lg">{qrCode}</p>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">Đang tìm kiếm thiết bị...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8">
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                errorType === 'access_denied' ? 'bg-orange-100' :
                errorType === 'network' ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                {errorType === 'access_denied' ? (
                  <AlertCircle className="h-8 w-8 text-orange-600" />
                ) : errorType === 'network' ? (
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                ) : (
                  <Search className="h-8 w-8 text-red-600" />
                )}
              </div>

              <h3 className={`mt-4 text-lg font-semibold ${
                errorType === 'access_denied' ? 'text-orange-900' :
                errorType === 'network' ? 'text-yellow-900' : 'text-red-900'
              }`}>
                {errorType === 'access_denied'
                  ? 'Không có quyền truy cập'
                  : errorType === 'network'
                  ? 'Lỗi kết nối mạng'
                  : 'Không tìm thấy thiết bị'}
              </h3>

              <p className={`mt-2 text-sm ${
                errorType === 'access_denied' ? 'text-orange-600' :
                errorType === 'network' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {error}
              </p>

              <div className="mt-4 space-y-3">
                {errorType === 'not_found' && (
                  <div className="bg-muted/50 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-foreground mb-2">Vui lòng kiểm tra:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Mã QR có đúng định dạng không (ví dụ: TB-001)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Thiết bị đã được đăng ký trong hệ thống chưa</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Thử quét lại mã QR để đảm bảo quét chính xác</span>
                      </li>
                    </ul>
                  </div>
                )}

                {errorType === 'access_denied' && (
                  <div className="bg-orange-50 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-orange-900 mb-2">Lý do có thể:</p>
                    <ul className="text-sm text-orange-700 space-y-1">
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Thiết bị thuộc đơn vị khác mà bạn không quản lý</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Tài khoản của bạn chưa được cấp quyền truy cập thiết bị này</span>
                      </li>
                    </ul>
                    <p className="text-sm text-orange-700 mt-2">
                      Liên hệ quản trị viên nếu bạn cần truy cập thiết bị này.
                    </p>
                  </div>
                )}

                {errorType === 'network' && (
                  <div className="bg-yellow-50 rounded-lg p-4 text-left">
                    <p className="text-sm text-yellow-700">
                      Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối Internet và thử lại.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={searchEquipment}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Thử lại
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={onClose}
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            </div>
          )}

          {equipment && !loading && (
            <>
              {/* Equipment Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{equipment.ten_thiet_bi}</h3>
                  <p className="text-sm text-muted-foreground">
                    {equipment.model} • {equipment.hang_san_xuat}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(equipment.tinh_trang_hien_tai || null)}
                  >
                    {equipment.tinh_trang_hien_tai || "Chưa xác định"}
                  </Badge>
                </div>

                <Separator />

                {/* Equipment Details */}
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mã thiết bị:</span>
                    <span className="font-mono font-semibold">{equipment.ma_thiet_bi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serial:</span>
                    <span className="font-mono">{equipment.serial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vị trí:</span>
                    <span>{equipment.vi_tri_lap_dat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Khoa/Phòng:</span>
                    <span>{equipment.khoa_phong_quan_ly}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Năm sản xuất:</span>
                    <span>{equipment.nam_san_xuat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá gốc:</span>
                    <span className="font-semibold">{equipment.gia_goc ? formatCurrency(equipment.gia_goc) : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="space-y-3">
                <h4 className="font-semibold">Hành động có thể thực hiện:</h4>
                
                <div className="grid gap-3">
                  <Button 
                    variant="default" 
                    className="justify-start h-auto p-4"
                    onClick={() => handleActionClick('usage-log')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Ghi nhật ký sử dụng thiết bị</div>
                        <div className="text-sm text-primary-foreground/80">
                          Theo dõi và ghi nhận quá trình sử dụng thiết bị
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => handleActionClick('view-details')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Eye className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Xem thông tin chi tiết</div>
                        <div className="text-sm text-muted-foreground">
                          Xem đầy đủ thông tin kỹ thuật và cấu hình
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => handleActionClick('view-history')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <History className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Lịch sử bảo trì & sửa chữa</div>
                        <div className="text-sm text-muted-foreground">
                          Xem lịch sử hoạt động và bảo trì thiết bị
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => handleActionClick('create-repair')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <Wrench className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Tạo yêu cầu sửa chữa</div>
                        <div className="text-sm text-muted-foreground">
                          Báo cáo sự cố và yêu cầu sửa chữa
                        </div>
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto p-4"
                    onClick={() => handleActionClick('update-status')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                        <Settings className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Cập nhật trạng thái</div>
                        <div className="text-sm text-muted-foreground">
                          Chỉnh sửa thông tin và trạng thái thiết bị
                        </div>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
} 
