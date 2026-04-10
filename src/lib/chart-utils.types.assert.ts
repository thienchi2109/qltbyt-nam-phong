import type { ChartData, ChartTooltipProps, RechartsComponents } from '@/lib/chart-utils'

type AssertFalse<T extends false> = T
type IsAny<T> = 0 extends (1 & T) ? true : false

type _chartDataValueNotAny = AssertFalse<IsAny<ChartData[string]>>
type _lineChartNotAny = AssertFalse<IsAny<RechartsComponents['LineChart']>>
type _tooltipNotAny = AssertFalse<IsAny<RechartsComponents['Tooltip']>>
type _tooltipPropsNotAny = AssertFalse<IsAny<ChartTooltipProps<number, string>>>
