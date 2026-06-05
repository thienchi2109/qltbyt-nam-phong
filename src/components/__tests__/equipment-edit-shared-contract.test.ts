import { describe, expect, it } from "vitest"

const importSharedEquipmentEditModule = (relativePath: string) =>
  import(/* @vite-ignore */ new URL(relativePath, import.meta.url).href)

describe("equipment edit shared contract", () => {
  it("exports a shared route-agnostic schema module", async () => {
    await expect(importSharedEquipmentEditModule("../equipment-edit/EquipmentEditTypes.ts")).resolves.toEqual(
      expect.objectContaining({
        equipmentFormSchema: expect.any(Object),
      })
    )
  })

  it("exports shared defaults and normalization helpers", async () => {
    const moduleImport = importSharedEquipmentEditModule(
      "../equipment-edit/EquipmentEditFormDefaults.ts"
    )

    await expect(moduleImport).resolves.toEqual(
      expect.objectContaining({
        DEFAULT_EQUIPMENT_FORM_VALUES: expect.any(Object),
        equipmentToFormValues: expect.any(Function),
      })
    )

    const mod = await moduleImport

    expect(mod.DEFAULT_EQUIPMENT_FORM_VALUES).toEqual(
      expect.objectContaining({
        ma_thiet_bi: "",
        ten_thiet_bi: "",
        nam_tinh_hao_mon: null,
        ty_le_hao_mon: null,
        chu_ky_bt_dinh_ky: null,
        ngay_bt_tiep_theo: null,
      })
    )

    expect(
      mod.equipmentToFormValues({
        ma_thiet_bi: "EQ-001",
        ten_thiet_bi: "Máy siêu âm",
        tinh_trang_hien_tai: "Hoạt động",
        vi_tri_lap_dat: "Phòng 101",
        khoa_phong_quan_ly: "Khoa Nội",
        nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
        nam_tinh_hao_mon: 2026,
        ty_le_hao_mon: "10%",
        chu_ky_bt_dinh_ky: 90,
        ngay_bt_tiep_theo: "2026-04-01",
        ngay_hc_tiep_theo: "2026-04-15",
        ngay_kd_tiep_theo: "2026-04-30",
      })
    ).toEqual(
      expect.objectContaining({
        ma_thiet_bi: "EQ-001",
        ten_thiet_bi: "Máy siêu âm",
        nam_tinh_hao_mon: 2026,
        ty_le_hao_mon: "10%",
        chu_ky_bt_dinh_ky: 90,
        ngay_bt_tiep_theo: "01/04/2026",
        ngay_hc_tiep_theo: "15/04/2026",
        ngay_kd_tiep_theo: "30/04/2026",
      })
    )
  })

  it("schema accepts depreciation and maintenance schedule fields", async () => {
    const mod = await importSharedEquipmentEditModule("../equipment-edit/EquipmentEditTypes.ts")

    const parsed = mod.equipmentFormSchema.parse({
      ma_thiet_bi: "EQ-001",
      ten_thiet_bi: "Máy siêu âm",
      vi_tri_lap_dat: "Phòng 101",
      khoa_phong_quan_ly: "Khoa Nội",
      nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
      tinh_trang_hien_tai: "Hoạt động",
      nam_tinh_hao_mon: "2026",
      ty_le_hao_mon: "10%",
      chu_ky_bt_dinh_ky: "90",
      ngay_bt_tiep_theo: "01/04/2026",
      chu_ky_hc_dinh_ky: "",
      ngay_hc_tiep_theo: "",
      chu_ky_kd_dinh_ky: "365",
      ngay_kd_tiep_theo: "30/04/2026",
    })

    expect(parsed).toEqual(
      expect.objectContaining({
        nam_tinh_hao_mon: 2026,
        ty_le_hao_mon: "10%",
        chu_ky_bt_dinh_ky: 90,
        ngay_bt_tiep_theo: "2026-04-01",
        chu_ky_hc_dinh_ky: null,
        ngay_hc_tiep_theo: null,
        chu_ky_kd_dinh_ky: 365,
        ngay_kd_tiep_theo: "2026-04-30",
      })
    )
  })

  it("exports a shared update primitive", async () => {
    await expect(
      importSharedEquipmentEditModule("../equipment-edit/useEquipmentEditUpdate.ts")
    ).resolves.toEqual(
      expect.objectContaining({
        useEquipmentEditUpdate: expect.any(Function),
      })
    )
  })

  it("keeps invalid nullable number input out of form state", async () => {
    const mod = await importSharedEquipmentEditModule(
      "../equipment-edit/EquipmentEditFieldUtils.ts"
    )

    expect(mod.toNullableNumber("")).toBeNull()
    expect(mod.toNullableNumber("-")).toBeNull()
    expect(mod.toNullableNumber("abc")).toBeNull()
    expect(mod.toNullableNumber("90")).toBe(90)
  })
})
