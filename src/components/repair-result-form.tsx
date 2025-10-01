"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CalendarDays, FileText, Printer, Save, Wrench } from "lucide-react"

interface RepairResultFormData {
  equipmentCode: string
  equipmentName: string
  repairRequestCode: string
  technician: string
  repairDate: string
  completionDate: string
  repairType: string
  issueDescription: string
  actionTaken: string
  partsReplaced: string[]
  testResults: string
  repairStatus: string
  warrantyCoverage: boolean
  cost: string
  notes: string
  nextMaintenanceDate: string
}

interface RepairResultFormProps {
  tenantId?: number | null  // New: Tenant ID for form branding context
}

export function RepairResultForm({ tenantId = null }: RepairResultFormProps = {}) {
  const [formData, setFormData] = React.useState<RepairResultFormData>({
    equipmentCode: "TM-BP-001",
    equipmentName: "Máy đo huyết áp điện tử Omron HEM-7120",
    repairRequestCode: "YC-SC-2024-0089",
    technician: "Nguyễn Văn Tài",
    repairDate: "2024-09-18",
    completionDate: "2024-09-19",
    repairType: "sửa-chữa-khẩn-cấp",
    issueDescription: "Màn hình LCD bị mờ, không hiển thị rõ số liệu đo",
    actionTaken: "Thay thế màn hình LCD, kiểm tra và hiệu chỉnh lại bộ cảm biến áp suất",
    partsReplaced: ["Màn hình LCD", "Cáp kết nối màn hình"],
    testResults: "Sau sửa chữa: Màn hình hoạt động bình thường, độ chính xác đo ±2mmHg (trong phạm vi cho phép)",
    repairStatus: "hoàn-thành",
    warrantyCoverage: false,
    cost: "850,000",
    notes: "Thiết bị đã được kiểm tra toàn diện và hoạt động ổn định",
    nextMaintenanceDate: "2025-03-19"
  })

  const handleInputChange = (field: keyof RepairResultFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePartsChange = (part: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      partsReplaced: checked 
        ? [...prev.partsReplaced, part]
        : prev.partsReplaced.filter(p => p !== part)
    }))
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSave = () => {
    console.log('Saving repair result form:', formData)
    alert('✅ Biểu mẫu đã được lưu thành công!')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen print:bg-white print:p-0">
      <Card className="bg-white shadow-lg print:shadow-none">
        <CardHeader className="text-center border-b print:border-b-2 print:border-black">
          <FormBrandingHeader 
            align="center" 
            size="lg" 
            showDivider 
            className="mb-4 print:mb-2"
            tenantId={tenantId}
          />
          <CardTitle className="text-2xl font-bold text-blue-600 print:text-black">
            <div className="flex items-center justify-center gap-2">
              <Wrench className="h-6 w-6" />
              BIÊN BẢN KẾT QUẢ SỬA CHỮA THIẾT BỊ Y TẾ
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 print:space-y-4">
          {/* Equipment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="equipmentCode">Mã thiết bị *</Label>
              <Input
                id="equipmentCode"
                value={formData.equipmentCode}
                onChange={(e) => handleInputChange('equipmentCode', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="repairRequestCode">Mã yêu cầu sửa chữa *</Label>
              <Input
                id="repairRequestCode"
                value={formData.repairRequestCode}
                onChange={(e) => handleInputChange('repairRequestCode', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="equipmentName">Tên thiết bị *</Label>
            <Input
              id="equipmentName"
              value={formData.equipmentName}
              onChange={(e) => handleInputChange('equipmentName', e.target.value)}
              className="mt-1"
            />
          </div>

          <Separator />

          {/* Repair Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="technician">Kỹ thuật viên thực hiện *</Label>
              <Input
                id="technician"
                value={formData.technician}
                onChange={(e) => handleInputChange('technician', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="repairType">Loại sửa chữa *</Label>
              <Select value={formData.repairType} onValueChange={(value) => handleInputChange('repairType', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bảo-trì-định-kỳ">Bảo trì định kỳ</SelectItem>
                  <SelectItem value="sửa-chữa-khẩn-cấp">Sửa chữa khẩn cấp</SelectItem>
                  <SelectItem value="hiệu-chuẩn">Hiệu chuẩn</SelectItem>
                  <SelectItem value="nâng-cấp">Nâng cấp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="repairDate">Ngày bắt đầu sửa chữa *</Label>
              <Input
                id="repairDate"
                type="date"
                value={formData.repairDate}
                onChange={(e) => handleInputChange('repairDate', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="completionDate">Ngày hoàn thành *</Label>
              <Input
                id="completionDate"
                type="date"
                value={formData.completionDate}
                onChange={(e) => handleInputChange('completionDate', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="issueDescription">Mô tả sự cố / vấn đề *</Label>
            <Textarea
              id="issueDescription"
              value={formData.issueDescription}
              onChange={(e) => handleInputChange('issueDescription', e.target.value)}
              className="mt-1 min-h-[80px]"
              placeholder="Mô tả chi tiết sự cố hoặc vấn đề cần sửa chữa..."
            />
          </div>

          <div>
            <Label htmlFor="actionTaken">Biện pháp khắc phục đã thực hiện *</Label>
            <Textarea
              id="actionTaken"
              value={formData.actionTaken}
              onChange={(e) => handleInputChange('actionTaken', e.target.value)}
              className="mt-1 min-h-[80px]"
              placeholder="Mô tả các biện pháp, quy trình sửa chữa đã thực hiện..."
            />
          </div>

          {/* Parts Replaced */}
          <div>
            <Label className="text-base font-medium">Linh kiện đã thay thế</Label>
            <div className="mt-2 space-y-2">
              {[
                "Màn hình LCD",
                "Cáp kết nối màn hình", 
                "Board mạch chính",
                "Cảm biến áp suất",
                "Pin/Adapter",
                "Vỏ thiết bị",
                "Khác"
              ].map((part) => (
                <div key={part} className="flex items-center space-x-2">
                  <Checkbox
                    id={part}
                    checked={formData.partsReplaced.includes(part)}
                    onCheckedChange={(checked) => handlePartsChange(part, !!checked)}
                  />
                  <Label htmlFor={part} className="text-sm">{part}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="testResults">Kết quả kiểm tra sau sửa chữa *</Label>
            <Textarea
              id="testResults"
              value={formData.testResults}
              onChange={(e) => handleInputChange('testResults', e.target.value)}
              className="mt-1 min-h-[80px]"
              placeholder="Mô tả kết quả kiểm tra, thử nghiệm sau khi sửa chữa..."
            />
          </div>

          <Separator />

          {/* Status and Cost */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="repairStatus">Trạng thái sửa chữa *</Label>
              <Select value={formData.repairStatus} onValueChange={(value) => handleInputChange('repairStatus', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoàn-thành">Hoàn thành</SelectItem>
                  <SelectItem value="hoàn-thành-có-hạn-chế">Hoàn thành có hạn chế</SelectItem>
                  <SelectItem value="không-sửa-được">Không sửa được</SelectItem>
                  <SelectItem value="cần-linh-kiện">Chờ linh kiện</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cost">Chi phí sửa chữa (VNĐ)</Label>
              <Input
                id="cost"
                value={formData.cost}
                onChange={(e) => handleInputChange('cost', e.target.value)}
                className="mt-1"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="warrantyCoverage"
              checked={formData.warrantyCoverage}
              onCheckedChange={(checked) => handleInputChange('warrantyCoverage', !!checked)}
            />
            <Label htmlFor="warrantyCoverage">Sửa chữa trong thời gian bảo hành</Label>
          </div>

          <div>
            <Label htmlFor="nextMaintenanceDate">Ngày bảo trì tiếp theo</Label>
            <Input
              id="nextMaintenanceDate"
              type="date"
              value={formData.nextMaintenanceDate}
              onChange={(e) => handleInputChange('nextMaintenanceDate', e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes">Ghi chú thêm</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="Ghi chú thêm về quá trình sửa chữa, khuyến nghị sử dụng..."
            />
          </div>

          <Separator />

          {/* Signature Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:mt-8">
            <div className="text-center">
              <p className="font-medium mb-4">Kỹ thuật viên thực hiện</p>
              <div className="border-b border-gray-300 w-48 mx-auto mb-2 print:border-black"></div>
              <p className="text-sm text-gray-600">Ký tên</p>
            </div>
            <div className="text-center">
              <p className="font-medium mb-4">Trưởng bộ phận kỹ thuật</p>
              <div className="border-b border-gray-300 w-48 mx-auto mb-2 print:border-black"></div>
              <p className="text-sm text-gray-600">Ký tên & đóng dấu</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center print:hidden">
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="mr-2 h-4 w-4" />
              Lưu biểu mẫu
            </Button>
            <Button onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              In biểu mẫu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}