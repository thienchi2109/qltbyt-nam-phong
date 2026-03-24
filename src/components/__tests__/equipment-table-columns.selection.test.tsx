import * as React from "react"
import { render, screen } from "@testing-library/react"
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

  it("formats ngay_ngung_su_dung as DD/MM/YYYY", () => {
    const columns = createEquipmentColumns({
      renderActions,
    })

    const column = columns.find((candidate) => candidate.accessorKey === "ngay_ngung_su_dung")
    expect(column).toBeDefined()

    const node = (column as NonNullable<typeof column>).cell?.({
      row: {
        getValue: (key: string) => (key === "ngay_ngung_su_dung" ? "2024-12-31" : undefined),
      },
    } as any)

    render(<>{node}</>)
    expect(screen.getByText("31/12/2024")).toBeInTheDocument()
  })
})
