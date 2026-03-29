import type { Equipment } from '@/types/database'
import {
  useCreateEquipment,
  useEquipment,
  useEquipmentDetail,
  useUpdateEquipment,
} from '@/hooks/use-cached-equipment'

type Assert<T extends true> = T

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false

type UseEquipmentData = Exclude<ReturnType<typeof useEquipment>['data'], undefined>
type UseEquipmentDetailData = ReturnType<typeof useEquipmentDetail>['data']
type UseUpdateEquipmentData = ReturnType<typeof useUpdateEquipment>['data']
type UseCreateEquipmentData = ReturnType<typeof useCreateEquipment>['data']

type _UseEquipmentDataIsEquipmentArray = Assert<IsEqual<UseEquipmentData, Equipment[]>>
type _UseEquipmentDetailDataMatchesEquipment = Assert<
  IsEqual<UseEquipmentDetailData, Equipment | null | undefined>
>
type _UseUpdateEquipmentDataMatchesVoid = Assert<
  IsEqual<UseUpdateEquipmentData, void | undefined>
>
type _UseCreateEquipmentDataMatchesEquipment = Assert<
  IsEqual<UseCreateEquipmentData, Equipment | undefined>
>
