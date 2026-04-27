import type { RepairRequestWithEquipment } from '@/app/(app)/repair-requests/types'

/**
 * Phase 1: only 'repair' is implemented. Phase 2/3 will add 'transfer' and
 * 'maintenance' (or split the latter into 'calibration' / 'inspection') without
 * changing the surrounding shape.
 */
export type LinkedRequestKind = 'repair'

export type ActiveRepairResult = {
  active_count: number
  request: RepairRequestWithEquipment | null
}

export type LinkedRequestState =
  | { open: false; kind: null; equipmentId: null }
  | { open: true; kind: LinkedRequestKind; equipmentId: number }
