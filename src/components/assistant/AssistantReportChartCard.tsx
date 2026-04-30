"use client"

import * as React from "react"

import {
  DynamicBarChart,
  DynamicLineChart,
  DynamicPieChart,
} from "@/components/dynamic-chart"
import type { ReportChartArtifact } from "@/lib/ai/tools/tool-response-envelope"

interface AssistantReportChartCardProps {
  artifact: ReportChartArtifact
}

const BAR_COLORS = ["hsl(var(--chart-1))"]
const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function AssistantReportChartCard({
  artifact,
}: AssistantReportChartCardProps) {
  return (
    <div
      data-testid="assistant-report-chart-card"
      className="mt-2 rounded-xl border border-[hsl(var(--assistant-tool-border))] bg-background/80 p-3"
    >
      {artifact.title ? (
        <h3 className="text-sm font-semibold text-foreground">{artifact.title}</h3>
      ) : null}
      {artifact.description ? (
        <p className="mt-1 text-xs text-muted-foreground">{artifact.description}</p>
      ) : null}

      <div className="mt-3">
        {artifact.chart.type === "bar" ? (
          <DynamicBarChart
            data={artifact.chart.data}
            xAxisKey={artifact.chart.xKey}
            yAxisKey={artifact.chart.yKey}
            bars={[{ key: artifact.chart.yKey, color: BAR_COLORS[0], name: artifact.chart.yKey }]}
            height={280}
            showLegend={false}
            xAxisAngle={artifact.chart.data.length > 6 ? -18 : 0}
          />
        ) : null}

        {artifact.chart.type === "line" ? (
          <DynamicLineChart
            data={artifact.chart.data}
            xAxisKey={artifact.chart.xKey}
            lines={[{ key: artifact.chart.yKey, color: BAR_COLORS[0], name: artifact.chart.yKey }]}
            height={280}
            showLegend={false}
          />
        ) : null}

        {artifact.chart.type === "pie" ? (
          <DynamicPieChart
            data={artifact.chart.data}
            dataKey={artifact.chart.valueKey}
            nameKey={artifact.chart.labelKey}
            colors={PIE_COLORS}
            height={280}
            innerRadius={artifact.chart.innerRadius}
          />
        ) : null}
      </div>

      {artifact.table && artifact.table.rows.length > 0 ? (
        <details className="mt-3 rounded-lg bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            Xem bảng dữ liệu
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  {artifact.table.columns.map((column) => (
                    <th
                      key={column}
                      className="px-2 py-1 text-left font-medium text-muted-foreground"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artifact.table.rows.map((row) => {
                  const rowKey = artifact.table?.columns
                    .map((column) => String(row[column] ?? ""))
                    .join("::")

                  return (
                  <tr key={rowKey} className="border-b border-border/30 last:border-0">
                    {artifact.table?.columns.map((column) => (
                      <td key={`${rowKey}-${column}`} className="px-2 py-1 text-foreground">
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  )
}
