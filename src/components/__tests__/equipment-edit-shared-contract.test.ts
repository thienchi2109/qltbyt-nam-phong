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
      })
    ).toEqual(
      expect.objectContaining({
        ma_thiet_bi: "EQ-001",
        ten_thiet_bi: "Máy siêu âm",
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
})
