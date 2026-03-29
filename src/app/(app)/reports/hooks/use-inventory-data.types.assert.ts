import { reportsKeys } from "@/app/(app)/reports/hooks/use-inventory-data"

type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type _inventoryDataFilters = Assert<
  Equal<Parameters<typeof reportsKeys.inventoryData>[0], Record<string, unknown>>
>
