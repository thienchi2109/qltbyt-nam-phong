export const dateRange = {
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-02-01T00:00:00.000Z"),
}

export function sampleRows() {
  return [
    {
      id: 1,
      ma_thiet_bi: "TB-001",
      ten_thiet_bi: "Máy thở hồi sức với tên dài để kiểm tra wrap",
      model: "M-1",
      serial: "SN-1",
      khoa_phong_quan_ly: "Khoa Hồi sức",
      ngay_nhap: "2026-01-02",
      created_at: "2026-01-02T08:00:00.000Z",
      type: "import" as const,
      source: "manual" as const,
      quantity: 1,
      value: 1_250_000,
      reason: "Bổ sung thiết bị",
      destination: "",
    },
    {
      id: 1,
      ma_thiet_bi: "TB-001",
      ten_thiet_bi: "Máy thở hồi sức với tên dài để kiểm tra wrap",
      model: "M-1",
      serial: "SN-1",
      khoa_phong_quan_ly: "Khoa Hồi sức",
      ngay_nhap: "2026-01-03",
      created_at: "2026-01-03T08:00:00.000Z",
      type: "export" as const,
      source: "transfer_internal" as const,
      quantity: 1,
      value: undefined,
      reason: "Điều chuyển",
      destination: "Khoa Cấp cứu",
    },
    {
      id: 2,
      ma_thiet_bi: "TB-002",
      ten_thiet_bi: "Monitor",
      model: "M-2",
      serial: "SN-2",
      khoa_phong_quan_ly: "Khoa Hồi sức",
      ngay_nhap: "2026-01-04",
      created_at: "2026-01-04T08:00:00.000Z",
      type: "export" as const,
      source: "liquidation" as const,
      quantity: 1,
      value: 0,
      reason: "Thanh lý",
      destination: "",
    },
  ]
}

export const summary = {
  totalImported: 7,
  totalExported: 8,
  currentStock: 42,
  netChange: -1,
}

export const maintenanceStats = {
  repair_summary: {
    total_requests: 4,
    completed: 3,
    pending: 0,
    in_progress: 1,
    total_cost: 12_500_000,
    average_completed_cost: 6_250_000,
    cost_recorded_count: 2,
    cost_missing_count: 1,
  },
  maintenance_summary: { total_plans: 2, total_tasks: 5, completed_tasks: 3 },
}
