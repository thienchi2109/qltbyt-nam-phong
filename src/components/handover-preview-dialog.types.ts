import type { TransferRequest } from "@/types/database"

export type HandoverPreviewDialogProps = Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferRequest | null
}>

export type HandoverDeviceData = Readonly<{
  code: string
  name: string
  model: string
  serial: string
  condition: string
  accessories: string
  note: string
}>

export type HandoverData = Readonly<{
  department: string
  handoverDate: string
  reason: string
  requestCode: string
  giverName: string
  directorName: string
  receiverName: string
  device: HandoverDeviceData
}>

export type HandoverField = Exclude<keyof HandoverData, "device"> | `device.${keyof HandoverDeviceData}`
