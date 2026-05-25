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
function DynamicChart({
  children,
  height = 300,
  fallbackHeight,
  onError,
}: DynamicChartProps) {
  const [components, setComponents] = React.useState<RechartsComponents | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  const loadCharts = React.useCallback(async () => {
    try {
      setError(null)
      setComponents(null)
      const chartComponents = await loadChartsLibrary()
      setComponents(chartComponents)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error loading charts')
      setError(error)
      onError?.(error)
    }
  }, [onError])

  React.useEffect(() => {
    loadCharts()
  }, [loadCharts])

  if (!components && !error) {
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
  customTooltip?: React.ElementType<ChartTooltipProps<number, string>>
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

/** Renders a lazy-loaded line chart. */
export function DynamicLineChart({
  data,
  height = 300,
  xAxisKey,
  lines,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  customTooltip,
  margin,
}: LineChartProps) {
  const CustomTooltipContent = customTooltip

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
            {showTooltip && (
              CustomTooltipContent ? <Tooltip content={<CustomTooltipContent />} /> : <Tooltip />
            )}
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

interface BarChartBaseProps {
  data: ChartData[]
  height?: number
  xAxisKey: string
  bars: Array<{
    key: string
    color: string
    name?: string
    stackId?: string
    cellColorKey?: string
  }>
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  xAxisAngle?: number
  customTooltip?: React.ElementType<ChartTooltipProps<number, string>>
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

type BarChartProps =
  | (BarChartBaseProps & { layout?: 'horizontal'; yAxisKey?: string })
  | (BarChartBaseProps & { layout: 'vertical'; yAxisKey: string })

/** Renders a lazy-loaded bar chart. */
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
  const verticalYAxisKey = yAxisKey

  if (isVertical && !verticalYAxisKey) {
    throw new Error('DynamicBarChart requires yAxisKey when layout is vertical')
  }
  const CustomTooltipContent = customTooltip

  return (
    <DynamicChart height={height}>
      {({ BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }) => (
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
                <YAxis dataKey={verticalYAxisKey} type="category" width={180} />
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
            {showTooltip && (
              CustomTooltipContent ? <Tooltip content={<CustomTooltipContent />} /> : <Tooltip />
            )}
            {showLegend && <Legend />}
            {bars.map(bar => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                fill={bar.color}
                name={bar.name || bar.key}
                stackId={bar.stackId}
              >
                {bar.cellColorKey
                  ? (() => {
                      const cellColorKey = bar.cellColorKey

                      return data.map((entry) => {
                        const fill = entry[cellColorKey]
                        const rawCellKey = entry[xAxisKey] ?? (verticalYAxisKey ? entry[verticalYAxisKey] : null) ?? fill

                        return typeof fill === "string" ? (
                          <Cell key={`${bar.key}-${String(rawCellKey)}`} fill={fill} />
                        ) : null
                      })
                    })()
                  : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </DynamicChart>
  )
}

interface ScatterChartProps<TData extends object> {
  data: TData[]
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

/** Renders a lazy-loaded scatter chart. */
export function DynamicScatterChart<TData extends object>({
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
}: ScatterChartProps<TData>) {
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
  colors?: string[]
  colorKey?: string
  showTooltip?: boolean
  showLabels?: boolean
  outerRadius?: number
  innerRadius?: number
  customTooltip?: React.ElementType<ChartTooltipProps<number, string>>
}

/** Renders a lazy-loaded pie chart. */
export function DynamicPieChart({
  data,
  height = 300,
  dataKey,
  nameKey,
  colors,
  colorKey = "color",
  showTooltip = true,
  showLabels = true,
  outerRadius = 80,
  innerRadius,
  customTooltip,
}: PieChartProps) {
  const CustomTooltipContent = customTooltip
  const pieSliceCells = React.useMemo(
    () => buildPieSliceCells(data, nameKey, colors, colorKey),
    [colorKey, colors, data, nameKey],
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
            {showTooltip && (
              CustomTooltipContent ? <Tooltip content={<CustomTooltipContent />} /> : <Tooltip />
            )}
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

/** Renders a lazy-loaded area chart. */
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
