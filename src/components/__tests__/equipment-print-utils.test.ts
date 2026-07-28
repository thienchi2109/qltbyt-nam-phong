import { describe, expect, it, vi, beforeEach } from "vitest"

import { generateProfileSheet } from "@/components/equipment/equipment-print-utils"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import type { Equipment } from "@/types/database"

const mockCallRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mockCallRpc,
}))

describe("equipment-print-utils", () => {
  const mockWindow = {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
  } as unknown as Window

  const createEquipment = (overrides: Partial<Equipment> = {}): Equipment =>
    ({
      id: 1,
      ma_thiet_bi: "EQ-001",
      ten_thiet_bi: "Máy siêu âm",
      khoa_phong_quan_ly: "Khoa Nội",
      don_vi: 1,
      ...overrides,
    }) as Equipment

  const createBranding = (overrides: Partial<TenantBranding> = {}): TenantBranding => ({
    id: 1,
    name: "Bệnh viện Đa khoa",
    logo_url: null,
    print_location: "An Giang",
    ...overrides,
  })

  const getWrittenHtml = (): string => {
    const writeMock = mockWindow.document.write as unknown as ReturnType<typeof vi.fn>
    return writeMock.mock.calls[0][0] as string
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockResolvedValue([])
    vi.spyOn(window, "open").mockReturnValue(mockWindow)
  })

  it("includes Ngày ngừng sử dụng in the profile sheet output", async () => {
    await generateProfileSheet(
      createEquipment({
        ngay_ngung_su_dung: "2024-12-31",
      }),
      {
        tenantBranding: null,
        userRole: "to_qltb",
        equipmentTenantId: 1,
      }
    )

    const writtenHtml = getWrittenHtml()
    expect(writtenHtml).toContain("Ngày ngừng sử dụng")
    expect(writtenHtml).toContain("31/12/2024")
  })

  it("escapes unexpected decommission-date strings before injecting profile sheet HTML", async () => {
    await generateProfileSheet(
      createEquipment({
        ngay_ngung_su_dung: '\"><script>alert(1)</script>',
      }),
      {
        tenantBranding: null,
        userRole: "to_qltb",
        equipmentTenantId: 1,
      }
    )

    const writtenHtml = getWrittenHtml()
    expect(writtenHtml).not.toContain("<script>alert(1)</script>")
    expect(writtenHtml).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  it("renders the equipment tenant print location in the profile sheet date line", async () => {
    await generateProfileSheet(createEquipment(), {
      tenantBranding: createBranding(),
      userRole: "to_qltb",
      equipmentTenantId: 1,
    })

    expect(getWrittenHtml()).toContain('value="An Giang"></span>, ngày')
  })

  it("escapes the equipment tenant print location before rendering it", async () => {
    await generateProfileSheet(createEquipment(), {
      tenantBranding: createBranding({
        print_location: 'An Giang"><script>alert(1)</script>',
      }),
      userRole: "to_qltb",
      equipmentTenantId: 1,
    })

    const writtenHtml = getWrittenHtml()
    expect(writtenHtml).not.toContain('value="An Giang"><script>alert(1)</script>"')
    expect(writtenHtml).toContain(
      'value="An Giang&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"></span>, ngày'
    )
  })

  it("renders an empty editable location input when print location is missing", async () => {
    await generateProfileSheet(createEquipment(), {
      tenantBranding: createBranding({ print_location: null }),
      userRole: "to_qltb",
      equipmentTenantId: 1,
    })

    expect(getWrittenHtml()).toContain(
      '<input type="text" class="form-input-line text-center italic" value=""></span>, ngày'
    )
  })

  it.each(["global", "admin"])(
    "does not render session tenant location when %s equipment-tenant lookup fails",
    async (userRole) => {
      await generateProfileSheet(createEquipment({ don_vi: 2 }), {
        tenantBranding: createBranding({
          id: 1,
          print_location: "Cần Thơ",
        }),
        userRole,
        equipmentTenantId: 1,
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "don_vi_branding_get",
        args: { p_id: 2 },
      })
      expect(getWrittenHtml()).not.toContain('value="Cần Thơ"></span>, ngày')
      expect(getWrittenHtml()).toContain(
        '<input type="text" class="form-input-line text-center italic" value=""></span>, ngày'
      )
    }
  )
})
