import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ChartTooltipProps } from "@/lib/chart-utils"

import { DynamicBarChart, DynamicLineChart, DynamicPieChart } from "@/components/dynamic-chart"

vi.mock("@/components/chart-fallbacks", () => ({
  ChartLoadingFallback: () => <div data-testid="chart-loading" />,
  ChartErrorFallback: () => <div data-testid="chart-error" />,
}))

vi.mock("@/lib/chart-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chart-utils")>()

  return {
    ...actual,
    loadChartsLibrary: async () => {
      const Tooltip = ({
        content,
      }: {
        content?: React.ReactNode | React.ComponentType<ChartTooltipProps<number, string>>
      }) => {
        const props = {
          active: true,
          label: 0,
          payload: [
            {
              dataKey: "value",
              value: 3,
              color: "#0088FE",
              payload: { name: "Khoa Nội", value: 3 },
            },
          ],
        } satisfies ChartTooltipProps<number, string>

        if (React.isValidElement(content)) {
          return React.cloneElement(content, props)
        }

        if (typeof content === "function") {
          return React.createElement(content, props)
        }

        return <div data-testid="default-tooltip">{props.label}</div>
      }

      return {
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Bar: () => <div />,
        XAxis: () => <div />,
        YAxis: () => <div />,
        CartesianGrid: () => <div />,
        Tooltip,
        Legend: () => <div />,
        LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Line: () => <div />,
        AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Area: () => <div />,
        ScatterChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Scatter: () => <div />,
        ZAxis: () => <div />,
        PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Pie: () => <div />,
        Cell: () => <div />,
      }
    },
  }
})

describe("DynamicBarChart tooltip integration", () => {
  it("passes memoized custom tooltip components to Recharts as a React element", async () => {
    const MemoTooltip = React.memo(function MemoTooltip({
      payload,
    }: ChartTooltipProps<number, string>) {
      const name = payload?.[0]?.payload?.name
      return <div data-testid="custom-tooltip">{name}</div>
    })

    render(
      <DynamicBarChart
        data={[{ name: "Khoa Nội", value: 3 }]}
        xAxisKey="name"
        bars={[{ key: "value", color: "#0088FE" }]}
        customTooltip={MemoTooltip}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("custom-tooltip")).toHaveTextContent("Khoa Nội")
    })
    expect(screen.queryByTestId("default-tooltip")).not.toBeInTheDocument()
  })

  it("passes custom line chart tooltip components to Recharts as a React element", async () => {
    function LineTooltip({
      payload,
    }: ChartTooltipProps<number, string>) {
      const name = payload?.[0]?.payload?.name
      return <div data-testid="line-tooltip">{name}</div>
    }

    render(
      <DynamicLineChart
        data={[{ name: "Khoa Nội", value: 3 }]}
        xAxisKey="name"
        lines={[{ key: "value", color: "#0088FE" }]}
        customTooltip={LineTooltip}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("line-tooltip")).toHaveTextContent("Khoa Nội")
    })
    expect(screen.queryByTestId("default-tooltip")).not.toBeInTheDocument()
  })

  it("passes custom pie chart tooltip components to Recharts as a React element", async () => {
    function PieTooltip({
      payload,
    }: ChartTooltipProps<number, string>) {
      const name = payload?.[0]?.payload?.name
      return <div data-testid="pie-tooltip">{name}</div>
    }

    render(
      <DynamicPieChart
        data={[{ name: "Khoa Nội", value: 3 }]}
        dataKey="value"
        nameKey="name"
        colors={["#0088FE"]}
        customTooltip={PieTooltip}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("pie-tooltip")).toHaveTextContent("Khoa Nội")
    })
    expect(screen.queryByTestId("default-tooltip")).not.toBeInTheDocument()
  })
})
