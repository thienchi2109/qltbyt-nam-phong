/**
 * Chart utilities with dynamic import for Recharts library
 * This ensures Recharts is only loaded when actually needed for chart rendering
 */

// Type definitions for Recharts (to avoid importing the full library)
export interface ChartData {
  [key: string]: any
}

export interface ChartProps {
  data: ChartData[]
  width?: string | number
  height?: string | number
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export interface RechartsComponents {
  LineChart: any
  BarChart: any
  AreaChart: any
  PieChart: any
  ResponsiveContainer: any
  XAxis: any
  YAxis: any
  CartesianGrid: any
  Tooltip: any
  Legend: any
  Line: any
  Bar: any
  Area: any
  Pie: any
  Cell: any
}

/**
 * Dynamically import Recharts library only when needed
 * This reduces initial bundle size by ~500KB
 */
export async function loadChartsLibrary(): Promise<RechartsComponents> {
  try {
    // Dynamic import - only loads when this function is called
    const recharts = await import('recharts')
    return {
      LineChart: recharts.LineChart,
      BarChart: recharts.BarChart,
      AreaChart: recharts.AreaChart,
      PieChart: recharts.PieChart,
      ResponsiveContainer: recharts.ResponsiveContainer,
      XAxis: recharts.XAxis,
      YAxis: recharts.YAxis,
      CartesianGrid: recharts.CartesianGrid,
      Tooltip: recharts.Tooltip,
      Legend: recharts.Legend,
      Line: recharts.Line,
      Bar: recharts.Bar,
      Area: recharts.Area,
      Pie: recharts.Pie,
      Cell: recharts.Cell,
    }
  } catch (error) {
    console.error('Failed to load charts library:', error)
    throw new Error('Không thể tải thư viện biểu đồ. Vui lòng thử lại.')
  }
}

/**
 * Chart loading component props
 */
export interface ChartLoadingFallbackProps {
  height?: number
}

/**
 * Error fallback component props
 */
export interface ChartErrorFallbackProps {
  error: Error
  onRetry?: () => void
  height?: number
}

/**
 * Common chart colors for consistent theming
 */
export const CHART_COLORS = {
  primary: '#447896',
  secondary: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  muted: '#94a3b8',
} as const

/**
 * Status colors for equipment charts
 */
export const STATUS_COLORS = {
  hoat_dong: '#22c55e',      // Green - Active
  bao_tri: '#f59e0b',        // Orange - Maintenance  
  hong: '#ef4444',           // Red - Broken
  thanh_ly: '#64748b',       // Gray - Liquidated
  cho_sua_chua: '#3b82f6',   // Blue - Waiting for repair
} as const

/**
 * Common chart configuration
 */
export const DEFAULT_CHART_CONFIG = {
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
  animationDuration: 300,
  grid: {
    strokeDasharray: '3 3',
    stroke: '#e2e8f0',
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
} as const

/**
 * Format number for chart display
 */
export function formatChartNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}

/**
 * Format percentage for chart display
 */
export function formatChartPercentage(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

/**
 * Generate chart data with proper formatting
 */
export function processChartData<T extends Record<string, any>>(
  data: T[],
  keyField: keyof T,
  valueField: keyof T,
  labelFormatter?: (key: string) => string
): ChartData[] {
  const grouped = data.reduce((acc, item) => {
    const key = String(item[keyField])
    const value = Number(item[valueField]) || 0
    acc[key] = (acc[key] || 0) + value
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped).map(([key, value]) => ({
    name: labelFormatter ? labelFormatter(key) : key,
    value,
    originalKey: key,
  }))
}

/**
 * Common responsive container props
 */
export const RESPONSIVE_CONTAINER_PROPS = {
  width: '100%' as const,
  height: '100%' as const,
  debounce: 50,
} as const
