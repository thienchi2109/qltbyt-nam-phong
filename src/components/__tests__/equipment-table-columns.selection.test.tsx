import { describe, expect, it, vi } from "vitest"

import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"

describe("createEquipmentColumns bulk selection config", () => {
  const renderActions = vi.fn((_equipment: Equipment) => null)

  it("prepends selection column when canBulkSelect=true", () => {
    const columns = createEquipmentColumns({
      renderActions,
      canBulkSelect: true,
    })

    expect(columns[0]?.id).toBe("select")
    expect(columns[1]?.accessorKey).toBe("id")
    expect(columns[columns.length - 1]?.id).toBe("actions")
  })

  it("keeps data columns first when canBulkSelect is omitted", () => {
    const columns = createEquipmentColumns({
      renderActions,
    })

    expect(columns[0]?.id).not.toBe("select")
    expect(columns[0]?.accessorKey).toBe("id")
    expect(columns[columns.length - 1]?.id).toBe("actions")
  })
})
