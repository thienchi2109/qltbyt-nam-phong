import { HandoverTemplate } from "@/components/handover-template"

// Mock data for demonstration
const mockData = {
  department: "Khoa Xét nghiệm - Cận lâm sàng",
  handoverDate: new Date("2025-07-04T10:00:00Z"),
  reason: "Bàn giao thiết bị mới được cấp theo quyết định số 123/QĐ-CDC",
  requestCode: "YCM-2025-07-456",
  giverName: "Nguyễn Văn An",
  receiverName: "Trần Thị Bình",
  devices: [
    { 
      code: "CDC-MIC-001", 
      name: "Kính hiển vi 2 mắt", 
      model: "CX-23", 
      serial: "SN-A123", 
      accessories: "01 Dây nguồn, 01 Hộp đựng", 
      condition: "Mới, hoạt động tốt", 
      note: "Đã kiểm tra" 
    },
    { 
      code: "CDC-CEN-005", 
      name: "Máy ly tâm", 
      model: "Hettich EBA 200", 
      serial: "SN-B456", 
      accessories: "01 Dây nguồn, 01 Rotor", 
      condition: "Mới, hoạt động tốt", 
      note: "" 
    },
    { 
      code: "CDC-AUT-002", 
      name: "Nồi hấp tiệt trùng", 
      model: "Sturdy SA-232X", 
      serial: "SN-C789", 
      accessories: "01 Khay đựng", 
      condition: "Mới, hoạt động tốt", 
      note: "Kiểm tra áp suất" 
    },
    { 
      code: "CDC-PIP-015", 
      name: "Pipet điện tử", 
      model: "Eppendorf Xplorer", 
      serial: "SN-D101", 
      accessories: "01 Sạc, 01 giá đỡ", 
      condition: "Mới, hoạt động tốt", 
      note: "" 
    },
    { 
      code: "CDC-REF-009", 
      name: "Tủ lạnh âm sâu", 
      model: "Panasonic MDF-U55V", 
      serial: "SN-E212", 
      accessories: "Chìa khóa, sách HDSD", 
      condition: "Mới, hoạt động tốt", 
      note: "Đạt nhiệt độ -80°C" 
    },
  ]
}

export default function HandoverTemplatePage() {
  return <HandoverTemplate {...mockData} />
}