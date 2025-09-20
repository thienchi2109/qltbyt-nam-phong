"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Info, Target, FileText, Lightbulb } from "lucide-react"

interface HandoverDemoData {
  department: string
  handoverDate: string
  reason: string
  requestCode: string
  giverName: string
  receiverName: string
  devices: Array<{
    code: string
    name: string
    model: string
    serial: string
    condition: string
    accessories: string
    note: string
  }>
}

export function HandoverDemo() {
  const openHandoverTemplate = () => {
    // Sample data for demo
    const sampleData: HandoverDemoData = {
      department: "Khoa Tim mạch",
      handoverDate: new Date().toLocaleDateString('vi-VN'),
      reason: "Luân chuyển thiết bị y tế theo quy định bảo trì định kỳ",
      requestCode: "LC-2024-0156",
      giverName: "Đại diện Khoa Tim mạch",
      receiverName: "Đại diện Tổ QLTB",
      devices: [{
        code: "TM-BP-001",
        name: "Máy đo huyết áp điện tử",
        model: "Omron HEM-7120",
        serial: "HEM7120-2024001",
        condition: "Hoạt động tốt",
        accessories: "Bộ măng sét size M, L; Hướng dẫn sử dụng; Thẻ bảo hành",
        note: "Đã hiệu chuẩn vào tháng 11/2024"
      }]
    }

    // Navigate to handover template with sample data
    const encodedData = encodeURIComponent(JSON.stringify(sampleData))
    const templateUrl = `/forms/handover-template?data=${encodedData}`
    
    const newWindow = window.open(templateUrl, '_blank')
    
    if (!newWindow) {
      alert('❌ Popup bị chặn! Vui lòng cho phép popup để sử dụng tính năng này.\n\n' +
            '🔧 Cách sửa:\n' +
            '1. Nhấn vào biểu tượng popup bị chặn trên thanh địa chỉ\n' +
            '2. Chọn "Luôn cho phép popup"\n' +
            '3. Thử lại')
    } else {
      console.log('✅ Demo template opened successfully!')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <FormBrandingHeader 
            align="center" 
            size="lg" 
            showDivider 
            className="mb-4" 
          />
          <CardTitle className="text-2xl font-bold text-center text-blue-600">
            🚀 Demo Phiếu Bàn Giao Thiết Bị - Phase 3 Hoàn Thành!
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>📋 Dữ liệu mẫu:</strong> Thiết bị máy đo huyết áp Omron HEM-7120 với đầy đủ thông tin luân chuyển nội bộ từ Khoa Tim mạch đến Tổ QLTB.
            </AlertDescription>
          </Alert>

          <Card className="bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-700 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                ✨ Tính năng Phase 3 - UX Enhancements:
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">🎨</span>
                  <span><strong>Preview Dialog</strong> - Giao diện đẹp với chế độ xem và sửa</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">🔄</span>
                  <span><strong>Auto-fill data</strong> - Tự động điền thông tin từ database</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">⌨️</span>
                  <span><strong>Keyboard shortcuts</strong> - Ctrl+E (sửa), Ctrl+P (in), Ctrl+Shift+P (xem trước)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">🎯</span>
                  <span><strong>Smart validation</strong> - Kiểm tra thông tin bắt buộc trước khi in</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">💡</span>
                  <span><strong>Tooltips & hints</strong> - Hướng dẫn rõ ràng cho từng tính năng</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">🔄</span>
                  <span><strong>Loading states</strong> - Phản hồi trực quan khi xử lý</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">🎉</span>
                  <span><strong>Better notifications</strong> - Thông báo thân thiện với emoji</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">🎛️</span>
                  <span><strong>Auto-close</strong> - Dialog tự động đóng sau khi in</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button 
              onClick={openHandoverTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              size="lg"
            >
              <FileText className="mr-2 h-5 w-5" />
              📄 Mở Phiếu Bàn Giao Mẫu
            </Button>
          </div>

          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              <strong>💡 Cách test:</strong>
              <br />1. Nhấn nút trên để mở phiếu mẫu
              <br />2. Thử các keyboard shortcuts: Ctrl+E, Ctrl+P, Ctrl+Shift+P
              <br />3. Hoặc vào ứng dụng chính → Transfers → chọn yêu cầu đang luân chuyển → nhấn nút 📄
            </AlertDescription>
          </Alert>

          <Card className="bg-purple-50">
            <CardHeader>
              <CardTitle className="text-purple-700 flex items-center gap-2">
                <Target className="h-5 w-5" />
                🎯 Roadmap tương lai (nếu cần):
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">📊</span>
                  <span>Export PDF trực tiếp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">📧</span>
                  <span>Email phiếu bàn giao</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">🗂️</span>
                  <span>Template library cho các loại thiết bị khác nhau</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">📱</span>
                  <span>Mobile optimization</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">🔄</span>
                  <span>Batch processing cho nhiều thiết bị</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">📈</span>
                  <span>Analytics và reporting</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}