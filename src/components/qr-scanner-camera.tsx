"use client"

import * as React from "react"
import { X, Camera, Flashlight, FlashlightOff, RotateCcw, HelpCircle, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import jsQR from "jsqr"

interface QRScannerCameraProps {
  onScanSuccess: (result: string) => void
  onClose: () => void
  isActive: boolean
}

export function QRScannerCamera({ onScanSuccess, onClose, isActive }: QRScannerCameraProps) {
  const { toast } = useToast()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const [isScanning, setIsScanning] = React.useState(false)
  const [hasFlash, setHasFlash] = React.useState(false)
  const [isFlashOn, setIsFlashOn] = React.useState(false)
  const [cameras, setCameras] = React.useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [showInstructions, setShowInstructions] = React.useState(false)

  // Cleanup on unmount - separate effect to ensure cleanup always runs
  React.useEffect(() => {
    return () => {
      // Ensure interval is cleared even on unexpected unmount
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
      }
      // Ensure stream is stopped
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Initialize camera
  React.useEffect(() => {
    if (isActive && typeof window !== "undefined") {
      initializeCamera()
    }

    return () => {
      cleanupCamera()
    }
  }, [isActive, selectedCameraId])

  const initializeCamera = async () => {
    try {
      setError(null)
      
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Trình duyệt không hỗ trợ camera API.\n\nVui lòng:\n• Sử dụng Chrome, Firefox, Safari, hoặc Edge\n• Cập nhật trình duyệt lên phiên bản mới nhất")
        return
      }
      
      // Check HTTPS requirement
      if (typeof window !== 'undefined' && location.protocol === 'http:' && !location.hostname.includes('localhost') && location.hostname !== '127.0.0.1') {
        setError(`❌ Camera chỉ hoạt động trên HTTPS hoặc localhost
        
Hiện tại bạn đang truy cập qua: ${location.origin}

✅ Giải pháp:
• Truy cập: http://localhost:9002/qr-scanner
• Thay vì: ${location.origin}/qr-scanner`)
        return
      }

      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setCameras(videoDevices)

      if (videoDevices.length === 0) {
        setError("❌ Không tìm thấy camera nào trên thiết bị\n\n🔧 Vui lòng kiểm tra:\n• Camera có được kết nối không\n• Driver camera đã cài đặt chưa\n• Camera có đang được sử dụng bởi app khác không")
        return
      }

      // Use selected camera or default to first available
      const deviceId = selectedCameraId || videoDevices[0].deviceId

      // Try with flexible constraints first
      let stream: MediaStream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { ideal: deviceId } : undefined,
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: { ideal: 'environment' }
          },
          audio: false
        })
      } catch (constraintError) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: deviceId ? { ideal: deviceId } : undefined,
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: false
          })
        } catch (basicError) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
        }
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Handle video play with proper error handling
        try {
          const playPromise = videoRef.current.play()
          if (playPromise !== undefined) {
            await playPromise
          }
          setIsScanning(true)
          
          // Start QR detection
          startQRDetection()
        } catch (playError) {
          // Continue anyway, video might still work
          setIsScanning(true)
          startQRDetection()
        }
      }

      // Check for flash support
      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities()
      setHasFlash('torch' in capabilities)

    } catch (error: any) {
      let errorMessage = "Không thể truy cập camera"
      
      if (error.name === 'NotAllowedError') {
        errorMessage = `❌ Quyền truy cập camera bị từ chối

🔧 Cách khắc phục:
• Nhấn vào biểu tượng khóa/camera trên thanh địa chỉ
• Chọn "Cho phép" camera
• Refresh trang và thử lại

📱 Trên mobile:
• Vào Settings → Site Settings → Camera
• Cho phép truy cập camera cho trang này`
      } else if (error.name === 'NotFoundError') {
        errorMessage = "❌ Không tìm thấy camera nào\n\n🔧 Vui lòng kiểm tra:\n• Camera có được kết nối không\n• Driver camera đã cài đặt chưa"
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "❌ Trình duyệt không hỗ trợ camera\n\n🔧 Vui lòng:\n• Sử dụng Chrome, Firefox, Safari hoặc Edge\n• Cập nhật trình duyệt lên phiên bản mới"
      } else if (error.name === 'NotReadableError') {
        errorMessage = "❌ Camera đang được sử dụng\n\n🔧 Vui lòng:\n• Đóng các ứng dụng khác đang dùng camera\n• Thử lại sau"
      } else if (error.name === 'SecurityError') {
        errorMessage = "❌ Lỗi bảo mật\n\nCamera chỉ hoạt động trên:\n• HTTPS\n• localhost\n• 127.0.0.1"
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "❌ Thiết lập camera không phù hợp\n\nThử lại với camera khác"
      }
      
      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Lỗi khởi tạo camera", 
        description: errorMessage
      })
    }
  }

  const cleanupCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    stopQRDetection()
    setIsScanning(false)
  }

  const toggleFlash = async () => {
    if (!hasFlash || !streamRef.current) return
    
    try {
      const track = streamRef.current.getVideoTracks()[0]
      await track.applyConstraints({
        advanced: [{ torch: !isFlashOn } as any]
      })
      setIsFlashOn(!isFlashOn)
      toast({
        title: isFlashOn ? "Đã tắt đèn flash" : "Đã bật đèn flash",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Không thể điều khiển đèn flash",
      })
    }
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return

    const currentIndex = cameras.findIndex(cam => cam.deviceId === selectedCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    const nextCamera = cameras[nextIndex]

    cleanupCamera()
    setSelectedCameraId(nextCamera.deviceId)
  }



  // QR Detection function
  const startQRDetection = () => {
    if (!videoRef.current || !isActive) return

    // Clear existing interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
    }

    const detectQR = () => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        return
      }

      try {
        // Create canvas to capture video frame
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Get image data for QR detection
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        
        // Use jsQR to detect QR codes
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        })
        
        if (qrCode) {
          // Stop detection and trigger success
          stopQRDetection()
          setIsScanning(false)
          onScanSuccess(qrCode.data)
        }

      } catch {
        // Silently ignore QR detection errors
      }
    }

    // Start detection interval - faster for better UX
    const interval = setInterval(detectQR, 250) // Check every 250ms for smoother detection
    scanIntervalRef.current = interval
  }

  const stopQRDetection = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold text-white">Quét mã QR</h2>
              <p className="text-sm text-white/80">Đưa mã QR vào khung để quét</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowInstructions(true)}
            className="text-white hover:bg-white/20"
          >
            <HelpCircle className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Camera Container */}
      <div className="flex items-center justify-center h-full pt-20 pb-32">
        <Card className="w-full max-w-md mx-4 bg-transparent border-0 shadow-none">
          <CardContent className="p-0">
            {/* Video Stream */}
            <div className="relative rounded-lg overflow-hidden bg-gray-900">
              <video
                ref={videoRef}
                className="w-full h-auto min-h-[300px] object-cover"
                playsInline
                muted
              />
              
              {/* Scanning Overlay */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="w-64 h-64 border-2 border-white rounded-lg relative">
                      {/* Corner indicators */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      
                      {/* Scanning line animation */}
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <div 
                          className="absolute left-0 right-0 h-0.5 bg-primary"
                          style={{ 
                            animation: "scan 2s linear infinite",
                          }} 
                        />
                      </div>
                    </div>
                    <p className="text-center text-white text-sm mt-4">
                      Đưa mã QR vào khung quét
                    </p>
                  </div>
                </div>
              )}
              
              {/* Loading/Error state */}
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 p-4">
                  <div className="text-center text-white max-w-sm">
                    {error ? (
                      <>
                        <X className="h-12 w-12 mx-auto mb-4 text-red-400" />
                        <h3 className="text-lg font-semibold mb-2">Không thể khởi động camera</h3>
                        <p className="text-sm text-gray-300 whitespace-pre-line">{error}</p>
                      </>
                    ) : (
                      <>
                        <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Đang khởi động camera...</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-8 p-6">
          {/* Flash Toggle */}
          {hasFlash && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFlash}
              className="text-white hover:bg-white/20 h-14 w-14 rounded-full"
            >
              {isFlashOn ? (
                <FlashlightOff className="h-6 w-6" />
              ) : (
                <Flashlight className="h-6 w-6" />
              )}
            </Button>
          )}

          {/* Camera Switch */}
          {cameras.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={switchCamera}
              className="text-white hover:bg-white/20 h-14 w-14 rounded-full"
            >
              <RotateCcw className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Hướng dẫn quét mã QR
            </DialogTitle>
            <DialogDescription>
              Làm theo các bước sau để quét mã QR thiết bị
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  1
                </div>
                <p className="text-sm">Đưa mã QR vào khung quét trên màn hình</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  2
                </div>
                <p className="text-sm">Giữ camera ổn định, cách mã QR khoảng 15-20cm</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  3
                </div>
                <p className="text-sm">Chờ hệ thống tự động nhận diện mã</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  4
                </div>
                <p className="text-sm">Chọn hành động muốn thực hiện với thiết bị</p>
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Mẹo:</strong> Đảm bảo mã QR không bị nhăn, mờ hoặc che khuất.
                Nếu quét không thành công, thử điều chỉnh khoảng cách hoặc góc quét.
              </p>
            </div>
            <Button
              onClick={() => setShowInstructions(false)}
              className="w-full"
            >
              Đã hiểu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSS for scanning animation */}
      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
      `}</style>
    </div>
  )
}