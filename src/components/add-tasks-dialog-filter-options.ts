import type { Equipment } from "@/lib/data"

interface AddTasksFilterOption {
  label: string
  value: string
}

interface AddTasksFilterOptions {
  departments: AddTasksFilterOption[]
  users: AddTasksFilterOption[]
  locations: AddTasksFilterOption[]
}

function getUniqueTrimmedValues(equipment: Equipment[], key: keyof Equipment): string[] {
  return Array.from(new Set(
    equipment.flatMap((item) => {
      const value = item[key]
      if (typeof value !== "string") return []
      const trimmed = value.trim()
      return trimmed ? [trimmed] : []
    }),
  ))
}

/** Builds stable faceted filter option lists for the add-tasks equipment table. */
export function buildAddTasksFilterOptions(equipment: Equipment[]): AddTasksFilterOptions {
  return {
    departments: getUniqueTrimmedValues(equipment, "khoa_phong_quan_ly").map((value) => ({ label: value, value })),
    users: getUniqueTrimmedValues(equipment, "nguoi_dang_truc_tiep_quan_ly").map((value) => ({ label: value, value })),
    locations: getUniqueTrimmedValues(equipment, "vi_tri_lap_dat").map((value) => ({ label: value, value })),
  }
}
