import { describe, expect, it } from "vitest"

import type { TransferRequest } from "@/types/database"
import type { TransferEquipmentOption } from "@/components/transfer-dialog.shared"
import {
  createEmptyTransferDialogState,
  createTransferDialogStateFromTransfer,
  transferDialogStateReducer,
} from "@/components/transfer-dialog.shared"

const equipment: TransferEquipmentOption = {
  id: 11,
  ma_thiet_bi: "TB-11",
  ten_thiet_bi: "Máy siêu âm",
  khoa_phong_quan_ly: "Khoa A",
}

const transfer: TransferRequest = {
  id: 7,
  ma_yeu_cau: "LC-0007",
  thiet_bi_id: 11,
  loai_hinh: "ben_ngoai",
  trang_thai: "cho_duyet",
  ly_do_luan_chuyen: "Điều phối",
  khoa_phong_hien_tai: "Khoa A",
  khoa_phong_nhan: "",
  muc_dich: "sua_chua",
  don_vi_nhan: "Bệnh viện B",
  dia_chi_don_vi: "12 Nguyễn Trãi",
  nguoi_lien_he: "Nguyễn Văn B",
  so_dien_thoai: "0900000000",
  ngay_du_kien_tra: "2026-05-01",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  thiet_bi: {
    id: 11,
    ma_thiet_bi: "TB-11",
    ten_thiet_bi: "Máy siêu âm",
    khoa_phong_quan_ly: "Khoa A",
  },
}

describe("transfer dialog shared reducer", () => {
  it("resets dirty add-dialog state back to the empty baseline", () => {
    const dirtyState = transferDialogStateReducer(createEmptyTransferDialogState(), {
      type: "EQUIPMENT_SELECTED",
      equipment,
    })

    const resetState = transferDialogStateReducer(dirtyState, {
      type: "RESET",
    })

    expect(resetState).toEqual(createEmptyTransferDialogState())
  })

  it("hydrates edit-dialog state from an existing transfer in one transition", () => {
    expect(createTransferDialogStateFromTransfer(transfer)).toEqual({
      formData: {
        thiet_bi_id: 11,
        loai_hinh: "ben_ngoai",
        ly_do_luan_chuyen: "Điều phối",
        khoa_phong_hien_tai: "Khoa A",
        khoa_phong_nhan: "",
        muc_dich: "sua_chua",
        don_vi_nhan: "Bệnh viện B",
        dia_chi_don_vi: "12 Nguyễn Trãi",
        nguoi_lien_he: "Nguyễn Văn B",
        so_dien_thoai: "0900000000",
        ngay_du_kien_tra: "2026-05-01",
      },
      searchTerm: "Máy siêu âm (TB-11)",
      selectedEquipment: equipment,
      isSubmitting: false,
    })
  })

  it("clears the selected equipment link when a new search term diverges", () => {
    const selectedState = transferDialogStateReducer(createEmptyTransferDialogState(), {
      type: "EQUIPMENT_SELECTED",
      equipment,
    })

    const searchedState = transferDialogStateReducer(selectedState, {
      type: "SEARCH_CHANGED",
      value: "Máy khác",
    })

    expect(searchedState).toMatchObject({
      searchTerm: "Máy khác",
      selectedEquipment: null,
      formData: expect.objectContaining({
        thiet_bi_id: 0,
        khoa_phong_hien_tai: "",
      }),
    })
  })
})
