import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { MaintenanceTask } from "@/lib/data"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useTaskColumns, type TaskColumnOptions } from "../_components/maintenance-columns"

describe("useTaskColumns", () => {
  const defaultOptions: TaskColumnOptions = {
    editingTaskId: null,
    handleStartEdit: vi.fn(),
    handleCancelEdit: vi.fn(),
    handleTaskDataChange: vi.fn(),
    handleSaveTask: vi.fn(),
    setTaskToDelete: vi.fn(),
    canManagePlans: true,
    isPlanApproved: false,
    canCompleteTask: true,
    handleMarkAsCompleted: vi.fn(),
    isCompletingTask: null,
    completionStatus: {},
    isLoadingCompletion: false,
    selectedPlan: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Column structure", () => {
    it("includes select column first", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      expect(result.current[0].id).toBe("select")
    })

    it("includes STT column", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const sttColumn = result.current.find((col) => col.id === "stt")
      expect(sttColumn).toBeDefined()
    })

    it("includes equipment code column", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const codeColumn = result.current.find(
        (col) => "accessorKey" in col && col.accessorKey === "thiet_bi.ma_thiet_bi"
      )
      expect(codeColumn).toBeDefined()
    })

    it("includes equipment name column", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const nameColumn = result.current.find(
        (col) => "accessorKey" in col && col.accessorKey === "thiet_bi.ten_thiet_bi"
      )
      expect(nameColumn).toBeDefined()
    })

    it("includes loai_cong_viec column", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const typeColumn = result.current.find(
        (col) => "accessorKey" in col && col.accessorKey === "loai_cong_viec"
      )
      expect(typeColumn).toBeDefined()
    })

    it("includes 12 month columns", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const monthColumns = result.current.filter(
        (col) => col.id?.startsWith("thang_")
      )
      expect(monthColumns.length).toBe(12)
    })

    it("includes don_vi_thuc_hien column", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const unitColumn = result.current.find(
        (col) => "accessorKey" in col && col.accessorKey === "don_vi_thuc_hien"
      )
      expect(unitColumn).toBeDefined()
    })

    it("includes ghi_chu column", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const notesColumn = result.current.find(
        (col) => "accessorKey" in col && col.accessorKey === "ghi_chu"
      )
      expect(notesColumn).toBeDefined()
    })

    it("includes actions column last", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const lastColumn = result.current[result.current.length - 1]
      expect(lastColumn.id).toBe("actions")
    })

    it("has correct total column count", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      // select + stt + ma_thiet_bi + ten_thiet_bi + loai_cong_viec +
      // 12 months + don_vi_thuc_hien + ghi_chu + actions = 20
      expect(result.current.length).toBe(20)
    })
  })

  describe("Column sizes", () => {
    it("select column has size 40", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const selectColumn = result.current.find((col) => col.id === "select")
      expect(selectColumn?.size).toBe(40)
    })

    it("stt column has size 50", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const sttColumn = result.current.find((col) => col.id === "stt")
      expect(sttColumn?.size).toBe(50)
    })

    it("month columns have size 40", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const monthColumns = result.current.filter(
        (col) => col.id?.startsWith("thang_")
      )
      monthColumns.forEach((col) => {
        expect(col.size).toBe(40)
      })
    })

    it("actions column has size 100", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const actionsColumn = result.current.find((col) => col.id === "actions")
      expect(actionsColumn?.size).toBe(100)
    })
  })

  describe("Options handling", () => {
    it("works with approved plan flag", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        isPlanApproved: true,
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
      expect(result.current.length).toBe(20)
    })

    it("works with editing task ID set", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        editingTaskId: 123,
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
      expect(result.current.length).toBe(20)
    })

    it("works with completion status populated", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        isPlanApproved: true,
        completionStatus: {
          "1-6": { historyId: 100 },
          "2-12": { historyId: 101 },
        },
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
    })

    it("works with completing task in progress", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        isPlanApproved: true,
        isCompletingTask: "1-6",
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
    })

    it("works with loading completion state", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        isPlanApproved: true,
        isLoadingCompletion: true,
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
    })

    it("works with selected plan set", () => {
      const mockPlan: MaintenancePlan = {
        id: 1,
        ten_ke_hoach: "Test Plan",
        nam: 2024,
        trang_thai: "Đã duyệt",
        loai_cong_viec: "Bảo dưỡng",
        don_vi_id: 1,
        khoa_phong_id: null,
        khoa_phong: null,
        nguoi_lap_ke_hoach: "Test User",
        ngay_phe_duyet: "2024-01-15T00:00:00Z",
        nguoi_duyet: "Admin",
        ly_do_khong_duyet: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }

      const options: TaskColumnOptions = {
        ...defaultOptions,
        selectedPlan: mockPlan,
        isPlanApproved: true,
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
    })

    it("works with canManagePlans false", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        canManagePlans: false,
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
    })

    it("works with canCompleteTask false", () => {
      const options: TaskColumnOptions = {
        ...defaultOptions,
        canCompleteTask: false,
      }

      const { result } = renderHook(() => useTaskColumns(options))

      expect(result.current).toBeDefined()
    })
  })

  describe("Select column configuration", () => {
    it("has sorting disabled", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const selectColumn = result.current.find((col) => col.id === "select")
      expect(selectColumn?.enableSorting).toBe(false)
    })

    it("has hiding disabled", () => {
      const { result } = renderHook(() => useTaskColumns(defaultOptions))

      const selectColumn = result.current.find((col) => col.id === "select")
      expect(selectColumn?.enableHiding).toBe(false)
    })
  })
})
