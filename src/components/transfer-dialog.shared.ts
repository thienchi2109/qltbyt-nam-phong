import type { Equipment, TransferPurpose, TransferRequest, TransferType } from "@/types/database"

export type TransferDialogFormData = {
  thiet_bi_id: number
  loai_hinh: TransferType | ""
  ly_do_luan_chuyen: string
  khoa_phong_hien_tai: string
  khoa_phong_nhan: string
  muc_dich: TransferPurpose | ""
  don_vi_nhan: string
  dia_chi_don_vi: string
  nguoi_lien_he: string
  so_dien_thoai: string
  ngay_du_kien_tra: string
}

export type TransferEquipmentOption = Pick<
  Equipment,
  "id" | "ma_thiet_bi" | "ten_thiet_bi" | "model" | "serial" | "khoa_phong_quan_ly"
>

export type TransferDialogState = {
  formData: TransferDialogFormData
  searchTerm: string
  selectedEquipment: TransferEquipmentOption | null
  isSubmitting: boolean
}

type TransferDialogFormDataUpdate =
  | TransferDialogFormData
  | ((previous: TransferDialogFormData) => TransferDialogFormData)

type TransferDialogStateAction =
  | { type: "RESET" }
  | { type: "LOAD_TRANSFER"; transfer: TransferRequest }
  | { type: "FORM_DATA_CHANGED"; value: TransferDialogFormDataUpdate }
  | { type: "SEARCH_CHANGED"; value: string }
  | { type: "EQUIPMENT_SELECTED"; equipment: TransferEquipmentOption }
  | { type: "SUBMIT_STARTED" }
  | { type: "SUBMIT_FINISHED" }

type TransferDialogPayload = {
  thiet_bi_id: number
  loai_hinh: TransferType
  ly_do_luan_chuyen: string
  nguoi_yeu_cau_id?: number
  created_by?: number
  updated_by?: number
  khoa_phong_hien_tai?: string | null
  khoa_phong_nhan?: string | null
  muc_dich?: TransferPurpose | null
  don_vi_nhan?: string | null
  dia_chi_don_vi?: string | null
  nguoi_lien_he?: string | null
  so_dien_thoai?: string | null
  ngay_du_kien_tra?: string | null
}

const EMPTY_FORM_DATA: TransferDialogFormData = {
  thiet_bi_id: 0,
  loai_hinh: "",
  ly_do_luan_chuyen: "",
  khoa_phong_hien_tai: "",
  khoa_phong_nhan: "",
  muc_dich: "",
  don_vi_nhan: "",
  dia_chi_don_vi: "",
  nguoi_lien_he: "",
  so_dien_thoai: "",
  ngay_du_kien_tra: "",
}

function trimValue(value: string): string {
  return value.trim()
}

function trimToNull(value: string): string | null {
  const trimmed = trimValue(value)
  return trimmed.length > 0 ? trimmed : null
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function buildInternalTransferFields(formData: TransferDialogFormData) {
  return {
    khoa_phong_hien_tai: trimValue(formData.khoa_phong_hien_tai),
    khoa_phong_nhan: trimValue(formData.khoa_phong_nhan),
    muc_dich: null,
    don_vi_nhan: null,
    dia_chi_don_vi: null,
    nguoi_lien_he: null,
    so_dien_thoai: null,
    ngay_du_kien_tra: null,
  } satisfies Pick<
    TransferDialogPayload,
    | "khoa_phong_hien_tai"
    | "khoa_phong_nhan"
    | "muc_dich"
    | "don_vi_nhan"
    | "dia_chi_don_vi"
    | "nguoi_lien_he"
    | "so_dien_thoai"
    | "ngay_du_kien_tra"
  >
}

function buildExternalTransferFields(formData: TransferDialogFormData) {
  return {
    muc_dich: formData.muc_dich || null,
    don_vi_nhan: trimToNull(formData.don_vi_nhan),
    dia_chi_don_vi: trimToNull(formData.dia_chi_don_vi),
    nguoi_lien_he: trimToNull(formData.nguoi_lien_he),
    so_dien_thoai: trimToNull(formData.so_dien_thoai),
    ngay_du_kien_tra: trimToNull(formData.ngay_du_kien_tra),
    khoa_phong_hien_tai: null,
    khoa_phong_nhan: null,
  } satisfies Pick<
    TransferDialogPayload,
    | "muc_dich"
    | "don_vi_nhan"
    | "dia_chi_don_vi"
    | "nguoi_lien_he"
    | "so_dien_thoai"
    | "ngay_du_kien_tra"
    | "khoa_phong_hien_tai"
    | "khoa_phong_nhan"
  >
}

function buildDisposalTransferFields(formData: TransferDialogFormData) {
  return {
    muc_dich: "thanh_ly",
    don_vi_nhan: "Tổ QLTB",
    khoa_phong_hien_tai: trimValue(formData.khoa_phong_hien_tai),
    khoa_phong_nhan: "Tổ QLTB",
    dia_chi_don_vi: null,
    nguoi_lien_he: null,
    so_dien_thoai: null,
    ngay_du_kien_tra: null,
  } satisfies Pick<
    TransferDialogPayload,
    | "muc_dich"
    | "don_vi_nhan"
    | "khoa_phong_hien_tai"
    | "khoa_phong_nhan"
    | "dia_chi_don_vi"
    | "nguoi_lien_he"
    | "so_dien_thoai"
    | "ngay_du_kien_tra"
  >
}

export function createEmptyTransferDialogFormData(): TransferDialogFormData {
  return { ...EMPTY_FORM_DATA }
}

export function createEmptyTransferDialogState(): TransferDialogState {
  return {
    formData: createEmptyTransferDialogFormData(),
    searchTerm: "",
    selectedEquipment: null,
    isSubmitting: false,
  }
}

export function normalizeSessionUserId(user: { id?: unknown } | null | undefined): number | null {
  const rawId = user?.id

  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return rawId
  }

  if (typeof rawId === "string" && /^\d+$/.test(rawId)) {
    return Number.parseInt(rawId, 10)
  }

  return null
}

export function getTransferDialogErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim().length > 0) {
      return message
    }
  }

  return fallback
}

export function mapEquipmentSearchResults(rows: unknown[]): TransferEquipmentOption[] {
  return rows.reduce<TransferEquipmentOption[]>((accumulator, row) => {
    if (typeof row !== "object" || row === null) {
      return accumulator
    }

    const record = row as Record<string, unknown>
    const id = readNumber(record, "id") ?? readNumber(record, "equipment_id")
    const maThietBi = readString(record, "ma_thiet_bi") ?? readString(record, "ma_tb")
    const tenThietBi = readString(record, "ten_thiet_bi") ?? readString(record, "ten_tb")

    if (id === null || id <= 0 || maThietBi === null || tenThietBi === null) {
      return accumulator
    }

    const equipment: TransferEquipmentOption = {
      id,
      ma_thiet_bi: maThietBi,
      ten_thiet_bi: tenThietBi,
    }

    const model = readString(record, "model") ?? readString(record, "model_number")
    const serial = readString(record, "serial") ?? readString(record, "serial_number")
    const department =
      readString(record, "khoa_phong_quan_ly") ??
      readString(record, "khoa_phong") ??
      readString(record, "department_name")

    if (model !== null) {
      equipment.model = model
    }

    if (serial !== null) {
      equipment.serial = serial
    }

    if (department !== null) {
      equipment.khoa_phong_quan_ly = department
    }

    accumulator.push(equipment)
    return accumulator
  }, [])
}

export function createTransferDialogFormDataFromTransfer(
  transfer: TransferRequest,
): TransferDialogFormData {
  return {
    thiet_bi_id: transfer.thiet_bi_id,
    loai_hinh: transfer.loai_hinh,
    ly_do_luan_chuyen: transfer.ly_do_luan_chuyen,
    khoa_phong_hien_tai: transfer.khoa_phong_hien_tai || "",
    khoa_phong_nhan: transfer.khoa_phong_nhan || "",
    muc_dich: transfer.muc_dich || "",
    don_vi_nhan: transfer.don_vi_nhan || "",
    dia_chi_don_vi: transfer.dia_chi_don_vi || "",
    nguoi_lien_he: transfer.nguoi_lien_he || "",
    so_dien_thoai: transfer.so_dien_thoai || "",
    ngay_du_kien_tra: transfer.ngay_du_kien_tra || "",
  }
}

export function getSelectedEquipmentFromTransfer(
  transfer: TransferRequest | null,
): TransferEquipmentOption | null {
  const equipment = transfer?.thiet_bi
  if (!equipment?.id) {
    return null
  }

  return {
    id: equipment.id,
    ma_thiet_bi: equipment.ma_thiet_bi,
    ten_thiet_bi: equipment.ten_thiet_bi,
    model: equipment.model ?? undefined,
    serial: (equipment.serial ?? equipment.serial_number) ?? undefined,
    khoa_phong_quan_ly: equipment.khoa_phong_quan_ly ?? undefined,
  }
}

export function createTransferDialogStateFromTransfer(
  transfer: TransferRequest,
): TransferDialogState {
  const selectedEquipment = getSelectedEquipmentFromTransfer(transfer)

  return {
    formData: createTransferDialogFormDataFromTransfer(transfer),
    searchTerm: selectedEquipment
      ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
      : "",
    selectedEquipment,
    isSubmitting: false,
  }
}

function updateTransferDialogFormData(
  previous: TransferDialogFormData,
  value: TransferDialogFormDataUpdate,
): TransferDialogFormData {
  return typeof value === "function" ? value(previous) : value
}

export function transferDialogStateReducer(
  state: TransferDialogState,
  action: TransferDialogStateAction,
): TransferDialogState {
  switch (action.type) {
    case "RESET":
      return createEmptyTransferDialogState()
    case "LOAD_TRANSFER":
      return createTransferDialogStateFromTransfer(action.transfer)
    case "FORM_DATA_CHANGED":
      return {
        ...state,
        formData: updateTransferDialogFormData(state.formData, action.value),
      }
    case "SEARCH_CHANGED": {
      const selectedValueLabel = state.selectedEquipment
        ? `${state.selectedEquipment.ten_thiet_bi} (${state.selectedEquipment.ma_thiet_bi})`
        : ""
      const shouldClearSelectedEquipment =
        state.selectedEquipment !== null && action.value !== selectedValueLabel

      if (!shouldClearSelectedEquipment) {
        return {
          ...state,
          searchTerm: action.value,
        }
      }

      return {
        ...state,
        searchTerm: action.value,
        selectedEquipment: null,
        formData: {
          ...state.formData,
          thiet_bi_id: 0,
          khoa_phong_hien_tai: "",
        },
      }
    }
    case "EQUIPMENT_SELECTED":
      return {
        ...state,
        searchTerm: `${action.equipment.ten_thiet_bi} (${action.equipment.ma_thiet_bi})`,
        selectedEquipment: action.equipment,
        formData: {
          ...state.formData,
          thiet_bi_id: action.equipment.id,
          khoa_phong_hien_tai: action.equipment.khoa_phong_quan_ly || "",
        },
      }
    case "SUBMIT_STARTED":
      return {
        ...state,
        isSubmitting: true,
      }
    case "SUBMIT_FINISHED":
      return {
        ...state,
        isSubmitting: false,
      }
    default:
      return state
  }
}

export function buildCreateTransferPayload({
  formData,
  currentUserId,
}: {
  formData: TransferDialogFormData
  currentUserId: number | null
}): TransferDialogPayload {
  const payload: TransferDialogPayload = {
    thiet_bi_id: formData.thiet_bi_id,
    loai_hinh: formData.loai_hinh as TransferType,
    ly_do_luan_chuyen: trimValue(formData.ly_do_luan_chuyen),
  }

  if (currentUserId !== null) {
    payload.nguoi_yeu_cau_id = currentUserId
    payload.created_by = currentUserId
    payload.updated_by = currentUserId
  }

  if (formData.loai_hinh === "noi_bo") {
    return { ...payload, ...buildInternalTransferFields(formData) }
  }

  if (formData.loai_hinh === "ben_ngoai") {
    return { ...payload, ...buildExternalTransferFields(formData) }
  }

  return { ...payload, ...buildDisposalTransferFields(formData) }
}

export function buildUpdateTransferPayload({
  formData,
  currentUserId,
}: {
  formData: TransferDialogFormData
  currentUserId: number | null
}): TransferDialogPayload {
  const payload: TransferDialogPayload = {
    thiet_bi_id: formData.thiet_bi_id,
    loai_hinh: formData.loai_hinh as TransferType,
    ly_do_luan_chuyen: trimValue(formData.ly_do_luan_chuyen),
  }

  if (currentUserId !== null) {
    payload.updated_by = currentUserId
  }

  if (formData.loai_hinh === "noi_bo") {
    return { ...payload, ...buildInternalTransferFields(formData) }
  }

  if (formData.loai_hinh === "thanh_ly") {
    return { ...payload, ...buildDisposalTransferFields(formData) }
  }

  return { ...payload, ...buildExternalTransferFields(formData) }
}
