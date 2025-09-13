"use client"

import * as React from "react"
import { Loader2, Upload, FileCheck, AlertTriangle } from "lucide-react"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { Equipment } from "@/lib/data"

// Required fields for equipment validation
const REQUIRED_FIELDS = {
  'khoa_phong_quan_ly': 'Khoa/phòng quản lý',
  'nguoi_dang_truc_tiep_quan_ly': 'Người sử dụng',
  'tinh_trang_hien_tai': 'Tình trạng',
  'vi_tri_lap_dat': 'Vị trí lắp đặt'
} as const;

// Validation function for equipment data
const validateEquipmentData = (data: Partial<Equipment>[], headerMapping: Record<string, string>) => {
  const errors: string[] = [];
  const validationResults: { isValid: boolean; missingFields: string[] }[] = [];

  data.forEach((item, index) => {
    const missingFields: string[] = [];

    // Check each required field
    Object.entries(REQUIRED_FIELDS).forEach(([dbKey, displayName]) => {
      const value = item[dbKey as keyof Equipment];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(displayName);
      }
    });

    validationResults.push({
      isValid: missingFields.length === 0,
      missingFields
    });

    if (missingFields.length > 0) {
      errors.push(`Dòng ${index + 2}: Thiếu ${missingFields.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validationResults
  };
};

// This mapping is crucial for converting Excel headers to database columns.
const headerToDbKeyMap: Record<string, string> = {
    'Mã thiết bị': 'ma_thiet_bi',
    'Tên thiết bị': 'ten_thiet_bi',
    'Model': 'model',
    'Serial': 'serial',
    'Cấu hình': 'cau_hinh_thiet_bi',
    'Phụ kiện kèm theo': 'phu_kien_kem_theo',
    'Hãng sản xuất': 'hang_san_xuat',
    'Nơi sản xuất': 'noi_san_xuat',
    'Năm sản xuất': 'nam_san_xuat',
    'Ngày nhập': 'ngay_nhap',
    'Ngày đưa vào sử dụng': 'ngay_dua_vao_su_dung',
    'Nguồn kinh phí': 'nguon_kinh_phi',
    'Giá gốc': 'gia_goc',
    'Năm tính hao mòn': 'nam_tinh_hao_mon',
    'Tỷ lệ hao mòn theo TT23': 'ty_le_hao_mon',
    'Hạn bảo hành': 'han_bao_hanh',
    'Vị trí lắp đặt': 'vi_tri_lap_dat',
    'Người sử dụng': 'nguoi_dang_truc_tiep_quan_ly',
    'Khoa/phòng quản lý': 'khoa_phong_quan_ly',
    'Tình trạng': 'tinh_trang_hien_tai',
    'Ghi chú': 'ghi_chu',
    'Chu kỳ BT định kỳ (ngày)': 'chu_ky_bt_dinh_ky',
    'Ngày BT tiếp theo': 'ngay_bt_tiep_theo',
    'Chu kỳ HC định kỳ (ngày)': 'chu_ky_hc_dinh_ky',
    'Ngày HC tiếp theo': 'ngay_hc_tiep_theo',
    'Chu kỳ KĐ định kỳ (ngày)': 'chu_ky_kd_dinh_ky',
    'Ngày KĐ tiếp theo': 'ngay_kd_tiep_theo',
    'Phân loại theo NĐ98': 'phan_loai_theo_nd98',
};


interface ImportEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportEquipmentDialog({ open, onOpenChange, onSuccess }: ImportEquipmentDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [parsedData, setParsedData] = React.useState<Partial<Equipment>[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<string[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const resetState = () => {
    setIsSubmitting(false)
    setSelectedFile(null)
    setParsedData([])
    setError(null)
    setValidationErrors([])
    if (fileInputRef.current) {
        fileInputRef.current.value = ""
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      resetState()
      return
    }

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        setError("File không hợp lệ. Vui lòng chọn một file Excel (.xlsx, .xls, .csv).")
        setSelectedFile(null)
        setParsedData([])
        return
    }

    setSelectedFile(file)
    setError(null)

    try {
        const workbook = await readExcelFile(file)
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json: Record<string, any>[] = await worksheetToJson(worksheet)

        if (json.length === 0) {
            setError("File không có dữ liệu. Vui lòng kiểm tra lại file của bạn.")
            setParsedData([])
            return
        }

        const transformedData = json.map(row => {
            const newRow: Partial<Equipment> = {}
            for (const header in row) {
                if (Object.prototype.hasOwnProperty.call(headerToDbKeyMap, header)) {
                    const dbKey = headerToDbKeyMap[header];
                    // @ts-ignore
                    newRow[dbKey] = row[header] === "" ? null : row[header]
                }
            }
            return newRow
        })

        // Validate the transformed data
        const validation = validateEquipmentData(transformedData, headerToDbKeyMap);
        if (!validation.isValid) {
            setValidationErrors(validation.errors);
        } else {
            setValidationErrors([]);
        }

        setParsedData(transformedData)
    } catch (err: any) {
        setError("Đã có lỗi xảy ra khi đọc file: " + err.message)
        setParsedData([])
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu hợp lệ để nhập.",
      })
      return
    }

    // Check validation before importing
    if (validationErrors.length > 0) {
      toast({
        variant: "destructive",
        title: "Dữ liệu không hợp lệ",
        description: "Vui lòng kiểm tra và sửa các lỗi trước khi nhập dữ liệu."
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Supabase insert expects objects without undefined keys.
      const dataToInsert = parsedData.map(item => {
        const cleanItem: Record<string, any> = {};
        Object.entries(item).forEach(([key, value]) => {
          if (value !== undefined) {
            cleanItem[key] = value;
          }
        });
        return cleanItem;
      });

      const { error } = await supabase.from("thiet_bi").insert(dataToInsert);

      if (error) {
        throw error
      }

      toast({
        title: "Thành công",
        description: `Đã nhập thành công ${parsedData.length} thiết bị.`,
      })
      onSuccess()
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể nhập dữ liệu. " + error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
      resetState()
      onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" onInteractOutside={(e) => e.preventDefault()} onCloseAutoFocus={resetState}>
        <DialogHeader>
          <DialogTitle>Nhập thiết bị từ file Excel</DialogTitle>
          <DialogDescription>
            Chọn file Excel (.xlsx) theo đúng định dạng mẫu để nhập hàng loạt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="excel-file">Chọn file</Label>
                <Input 
                    id="excel-file" 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    disabled={isSubmitting}
                />
            </div>
            {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}
            {validationErrors.length > 0 && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Dữ liệu không hợp lệ:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-6">
                        {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}
            {selectedFile && !error && validationErrors.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md">
                    <FileCheck className="h-4 w-4" />
                    <span>
                        Đã đọc file <strong>{selectedFile.name}</strong>. Tìm thấy <strong>{parsedData.length}</strong> bản ghi hợp lệ.
                    </span>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={isSubmitting || !selectedFile || error !== null || parsedData.length === 0 || validationErrors.length > 0}
            >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Đang nhập..." : `Nhập ${parsedData.length} thiết bị`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
