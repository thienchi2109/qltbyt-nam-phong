import { MaintenanceForm } from "@/components/maintenance-form"

// Mock data for demonstration
const mockData = {
  department: "Khoa Xét nghiệm - Cận lâm sàng",
  year: 2025,
  devices: [
    {
      code: "CDC-MIC-001",
      name: "Kính hiển vi 2 mắt",
      department: "Khoa XN-CLSàng",
      internalImplementation: true,
      outsourcedImplementation: false,
      months: [true, false, false, false, false, false, true, false, false, false, false, false],
      calibrationPoint: "Tại chỗ"
    },
    {
      code: "CDC-CEN-005",
      name: "Máy ly tâm",
      department: "Khoa XN-CLSàng",
      internalImplementation: false,
      outsourcedImplementation: true,
      months: [false, false, true, false, false, false, false, false, true, false, false, false],
      calibrationPoint: "Công ty TNHH ABC"
    },
    {
      code: "CDC-AUT-002",
      name: "Nồi hấp tiệt trùng",
      department: "Khoa XN-CLSàng",
      internalImplementation: true,
      outsourcedImplementation: false,
      months: [false, false, false, true, false, false, false, false, false, true, false, false],
      calibrationPoint: "Tại chỗ"
    }
  ]
}

export default function MaintenanceFormPage() {
  return <MaintenanceForm {...mockData} />
}