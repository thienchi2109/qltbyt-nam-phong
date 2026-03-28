import { describe, expect, it } from "vitest"

import { mapEquipmentAttentionRows } from "../use-dashboard-stats.types"

describe("mapEquipmentAttentionRows", () => {
  it("normalizes nullable fields from equipment attention rows", () => {
    expect(
      mapEquipmentAttentionRows([
        {
          id: 7,
          ten_thiet_bi: "Máy X quang",
          ma_thiet_bi: "TB-007",
          model: undefined,
          tinh_trang_hien_tai: "Chờ bảo trì",
          vi_tri_lap_dat: undefined,
          ngay_bt_tiep_theo: undefined,
        },
      ]),
    ).toEqual([
      {
        id: 7,
        ten_thiet_bi: "Máy X quang",
        ma_thiet_bi: "TB-007",
        model: null,
        tinh_trang_hien_tai: "Chờ bảo trì",
        vi_tri_lap_dat: null,
        ngay_bt_tiep_theo: null,
      },
    ])
  })

  it("returns an empty list for nullish input", () => {
    expect(mapEquipmentAttentionRows(null)).toEqual([])
    expect(mapEquipmentAttentionRows(undefined)).toEqual([])
  })
})
