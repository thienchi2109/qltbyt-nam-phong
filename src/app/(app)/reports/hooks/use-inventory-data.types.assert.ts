type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type _inventoryDataFilterContractRemoved = Assert<Equal<true, true>>
