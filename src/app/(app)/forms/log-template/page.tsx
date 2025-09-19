import { LogTemplate } from "@/components/log-template"

// Mock data for demonstration
const mockData = {
  department: "Khoa Xét nghiệm - Cận lâm sàng",
  deviceManager: "Nguyễn Văn An",
  deviceName: "Kính hiển vi 2 mắt Olympus",
  deviceCode: "CDC-MIC-001",
  model: "CX-23",
  serial: "SN-A123456",
  usageLogs: [
    {
      dateTime: "08:30 - 12/07/2025",
      user: "BS. Nguyễn Thị Bình",
      condition: "Tốt",
      note: "Xét nghiệm máu thường quy"
    },
    {
      dateTime: "14:00 - 12/07/2025",
      user: "KTV. Trần Văn Cường",
      condition: "Tốt",
      note: "Xét nghiệm nước tiểu"
    },
    {
      dateTime: "09:15 - 13/07/2025",
      user: "BS. Lê Thị Dung",
      condition: "Tốt",
      note: "Quan sát tế bào"
    }
  ]
}

export default function LogTemplatePage() {
  return <LogTemplate {...mockData} />
}