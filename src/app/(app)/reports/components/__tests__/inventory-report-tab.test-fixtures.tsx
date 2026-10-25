import type { ReactNode } from "react"

export const successfulZeroResult = {
  data: {
    data: [],
    summary: { totalImported: 0, totalExported: 0, currentStock: 0, netChange: 0 },
    departments: ["Khoa Nội"],
  },
  isLoading: false,
  isFetching: false,
  isError: false,
  isPlaceholderData: false,
  error: null,
}

export const unusedEquipmentReportResult = {
  summary: {
    totalCount: 2,
    deviceTypeCount: 1,
    departmentCount: 1,
    totalOriginalValue: 3000000,
  },
  topDeviceGroups: [
    {
      deviceName: "Máy thở HFNC",
      equipmentCount: 2,
      totalOriginalValue: 3000000,
    },
  ],
  departments: [
    {
      departmentName: "ICU",
      equipmentCount: 2,
      totalOriginalValue: 3000000,
    },
  ],
  items: [
    {
      id: 1,
      maThietBi: "TB001",
      tenThietBi: "Máy thở HFNC",
      model: "HFNC",
      serial: "SER001",
      khoaPhongQuanLy: "ICU",
      ngayNhap: "2026-01-10",
      createdAt: "2026-01-10T00:00:00.000Z",
      giaGoc: 3000000,
      donVi: 17,
    },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 10,
}

type ListFilterSearchCardProps = {
  title?: ReactNode
  description?: ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filterControls?: ReactNode
  actions?: ReactNode
}

export function ListFilterSearchCardStub({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterControls,
  actions,
}: ListFilterSearchCardProps) {
  return (
    <section data-testid="reports-shared-filter-section">
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      {searchPlaceholder ? (
        <input
          aria-label={searchPlaceholder}
          value={searchValue ?? ""}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      ) : null}
      {filterControls}
      {actions}
    </section>
  )
}
