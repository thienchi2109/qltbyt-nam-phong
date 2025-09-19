import { HandoverTemplate } from "@/components/handover-template"

// Mock data for handover update demonstration
const mockData = {
  department: "Tổ QLTB",
  handoverDate: new Date("2025-07-15T14:30:00Z"),
  reason: "Cập nhật thông tin bàn giao thiết bị sau bảo trì",
  requestCode: "YCM-2025-07-789",
  giverName: "Trần Văn Cường",
  directorName: "PGS.TS. Lê Minh Đức",
  receiverName: "Nguyễn Thị Mai",
  devices: [
    { 
      code: "CDC-ECG-003", 
      name: "Máy điện tim 12 kênh", 
      model: "Fukuda CardiMax FX-8322", 
      serial: "SN-F987", 
      accessories: "01 Dây nguồn, 12 điện cực, 01 giấy ghi ECG", 
      condition: "Đã bảo trì, hoạt động tốt", 
      note: "Đã thay pin backup" 
    },
    { 
      code: "CDC-ULS-007", 
      name: "Máy siêu âm doppler", 
      model: "Mindray DC-40", 
      serial: "SN-G654", 
      accessories: "02 đầu dò, 01 gel siêu âm", 
      condition: "Đã hiệu chuẩn, hoạt động tốt", 
      note: "Cần bảo quản ở nhiệt độ phòng" 
    }
  ]
}

export default function HandoverUpdatePage() {
  return <HandoverTemplate {...mockData} />
}