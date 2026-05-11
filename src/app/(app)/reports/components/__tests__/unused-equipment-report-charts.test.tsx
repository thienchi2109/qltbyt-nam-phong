import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UnusedEquipmentCharts } from "../unused-equipment-report-charts"

const mocks = vi.hoisted(() => ({
  dynamicPieChart: vi.fn(() => <div data-testid="pie-chart" />),
  dynamicBarChart: vi.fn(() => <div data-testid="bar-chart" />),
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicPieChart: (props: unknown) => mocks.dynamicPieChart(props),
  DynamicBarChart: (props: unknown) => mocks.dynamicBarChart(props),
}))

describe("UnusedEquipmentCharts", () => {
  it("renders distributions as labeled donut charts instead of horizontal bars", () => {
    render(
      <UnusedEquipmentCharts
        isLoading={false}
        deviceGroups={[
          { deviceName: "Máy thở", equipmentCount: 3, totalOriginalValue: 3000000 },
          { deviceName: "Bơm tiêm điện", equipmentCount: 2, totalOriginalValue: 2000000 },
        ]}
        departments={[
          { departmentName: "Khoa Nội", equipmentCount: 4, totalOriginalValue: 4000000 },
          { departmentName: "Khoa Ngoại", equipmentCount: 1, totalOriginalValue: 1000000 },
        ]}
      />
    )

    expect(mocks.dynamicBarChart).not.toHaveBeenCalled()
    expect(mocks.dynamicPieChart).toHaveBeenCalledTimes(2)
    expect(mocks.dynamicPieChart).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dataKey: "value",
        nameKey: "name",
        customTooltip: expect.any(Function),
      })
    )

    expect(screen.getByTestId("unused-equipment-device-legend")).toHaveTextContent("Máy thở")
    expect(screen.getByTestId("unused-equipment-device-legend")).toHaveTextContent("3 thiết bị")
    expect(screen.getByTestId("unused-equipment-department-legend")).toHaveTextContent("Khoa Nội")
    expect(screen.getByTestId("unused-equipment-department-legend")).toHaveTextContent("4 thiết bị")
  })
})
