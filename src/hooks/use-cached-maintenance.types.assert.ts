import { maintenanceKeys } from "@/hooks/use-cached-maintenance"

type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type _listFilters = Assert<
  Equal<Parameters<typeof maintenanceKeys.list>[0], Record<string, unknown>>
>
type _scheduleFilters = Assert<
  Equal<Parameters<typeof maintenanceKeys.schedule>[0], Record<string, unknown>>
>
type _planFilters = Assert<
  Equal<Parameters<typeof maintenanceKeys.plan>[0], Record<string, unknown>>
>
