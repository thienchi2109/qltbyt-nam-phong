"use client"

import * as React from "react"
import {
  loadChartsLibrary,
  type ChartData,
  type ChartTooltipProps,
  type RechartsComponents,
} from "@/lib/chart-utils"
import { ChartLoadingFallback, ChartErrorFallback } from "@/components/chart-fallbacks"
import { buildPieSliceCells } from "@/lib/runtime-list-keys"

interface DynamicChartProps {
  children: (components: RechartsComponents) => React.ReactNode
  height?: number
  fallbackHeight?: number
  onError?: (error: Error) => void
}

/**
 * Dynamic Chart Component
 * Loads Recharts library only when needed and provides loading/error states
 */
export function DynamicChart({
  children,
  height = 300,
  fallbackHeight,
  onError,
}: DynamicChartProps) {
  const [components, setComponents] = React.useState<RechartsComponents | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadCharts = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const chartComponents = await loadChartsLibrary()
      setComponents(chartComponents)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error loading charts')
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }, [onError])

  React.useEffect(() => {
    loadCharts()
  }, [loadCharts])

  if (isLoading) {
    return <ChartLoadingFallback height={fallbackHeight || height} />
  }

  if (error) {
    return (
      <ChartErrorFallback 
        error={error} 
        onRetry={loadCharts}
        height={fallbackHeight || height}
      />
    )
  }

  if (!components) {
    return <ChartLoadingFallback height={fallbackHeight || height} />
  }

  return <>{children(components)}</>
}

/**
 * Specific chart components with dynamic loading
 */

interface LineChartProps {
  data: ChartData[]
  height?: number
  xAxisKey: string
  lines: Array<{
    key: string
    color: string
    name?: string
  }>
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export function DynamicLineChart({
  data,
  height = 300,
  xAxisKey,
  lines,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  margin,
}: LineChartProps) {
  return (
    <DynamicChart height={height}>
      {({ LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={
              margin || {
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }
            }
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            {showTooltip && <Tooltip />}
            {showLegend && <Legend />}
            {lines.map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                name={line.name || line.key}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </DynamicChart>
  )
}

interface BarChartProps {
  data: ChartData[]
  height?: number
  xAxisKey: string
  yAxisKey?: string
  layout?: 'horizontal' | 'vertical'
  bars: Array<{
    key: string
    color: string
    name?: string
    stackId?: string
  }>
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  xAxisAngle?: number
  customTooltip?: React.FC<ChartTooltipProps<number, string>>
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export function DynamicBarChart({
  data,
  height = 300,
  xAxisKey,
  yAxisKey,
  layout = 'horizontal',
  bars,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  xAxisAngle = 0,
  customTooltip,
  margin,
}: BarChartProps) {
  const isVertical = layout === 'vertical'

  return (
    <DynamicChart height={height}>
      {({ BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            layout={isVertical ? 'vertical' : undefined}
            data={data}
            margin={margin || {
              top: 20,
              right: 30,
              left: 20,
              bottom: xAxisAngle !== 0 ? 100 : 5
            }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            {isVertical ? (
              <>
                <XAxis type="number" />
                <YAxis dataKey={yAxisKey ?? xAxisKey} type="category" width={180} />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xAxisKey}
                  angle={xAxisAngle}
                  textAnchor={xAxisAngle !== 0 ? "end" : "middle"}
                  height={xAxisAngle !== 0 ? 100 : undefined}
                  interval={0}
                />
                <YAxis />
              </>
            )}
            {showTooltip && (customTooltip ? <Tooltip content={customTooltip} /> : <Tooltip />)}
            {showLegend && <Legend />}
            {bars.map(bar => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                fill={bar.color}
                name={bar.name || bar.key}
                stackId={bar.stackId}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </DynamicChart>
  )
}

interface ScatterChartProps {
  data: ChartData[]
  height?: number
  xAxisKey: string
  yAxisKey: string
  zAxisKey?: string
  scatterName?: string
  fill?: string
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export function DynamicScatterChart({
  data,
  height = 300,
  xAxisKey,
  yAxisKey,
  zAxisKey,
  scatterName,
  fill = 'hsl(var(--chart-1))',
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  margin,
}: ScatterChartProps) {
  return (
    <DynamicChart height={height}>
      {({ ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart
            margin={
              margin || {
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }
            }
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} type="number" />
            <YAxis dataKey={yAxisKey} type="number" />
            {zAxisKey ? <ZAxis dataKey={zAxisKey} range={[100, 320]} /> : null}
            {showTooltip && <Tooltip cursor={{ strokeDasharray: '3 3' }} />}
            {showLegend && <Legend />}
            <Scatter data={data} fill={fill} name={scatterName || yAxisKey} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </DynamicChart>
  )
}

interface PieChartProps {
  data: ChartData[]
  height?: number
  dataKey: string
  nameKey: string
  colors: string[]
  showTooltip?: boolean
  showLabels?: boolean
  outerRadius?: number
  innerRadius?: number
}

export function DynamicPieChart({
  data,
  height = 300,
  dataKey,
  nameKey,
  colors,
  showTooltip = true,
  showLabels = true,
  outerRadius = 80,
  innerRadius,
}: PieChartProps) {
  const pieSliceCells = React.useMemo(
    () => buildPieSliceCells(data, nameKey, colors),
    [colors, data, nameKey],
  )

  return (
    <DynamicChart height={height}>
      {({ PieChart, Pie, Cell, Tooltip, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              label={showLabels ? ({ name, value, percent }: { name: string; value: number; percent: number }) => 
                `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : false
              }
            >
              {pieSliceCells.map((cell) => (
                <Cell key={cell.key} fill={cell.fill} />
              ))}
            </Pie>
            {showTooltip && <Tooltip />}
          </PieChart>
        </ResponsiveContainer>
      )}
    </DynamicChart>
  )
}

interface AreaChartProps {
  data: ChartData[]
  height?: number
  xAxisKey: string
  areas: Array<{
    key: string
    color: string
    name?: string
    stackId?: string
  }>
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
}

export function DynamicAreaChart({
  data,
  height = 300,
  xAxisKey,
  areas,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
}: AreaChartProps) {
  return (
    <DynamicChart height={height}>
      {({ AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }) => (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            {showTooltip && <Tooltip />}
            {showLegend && <Legend />}
            {areas.map(area => (
              <Area
                key={area.key}
                type="monotone"
                dataKey={area.key}
                fill={area.color}
                stroke={area.color}
                name={area.name || area.key}
                stackId={area.stackId}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </DynamicChart>
  )
}
