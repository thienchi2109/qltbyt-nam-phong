import { vi } from "vitest"
import { render } from "@testing-library/react"
import * as React from "react"

// Mock the rpc-client module
vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

// Mock the toast hook
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock radix-ui sheet component for testing
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="sheet-title">{children}</h2>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="sheet-description">{children}</p>
  ),
}))

// Import after mocks
import { QRActionSheet } from "../qr-action-sheet"
import { callRpc } from "@/lib/rpc-client"

export const mockCallRpc = vi.mocked(callRpc)

// Sample equipment data for tests
export const mockEquipment = {
  id: 123,
  ma_thiet_bi: "TB-001",
  ten_thiet_bi: "Máy siêu âm",
  model: "SU-500",
  serial: "SN12345",
  hang_san_xuat: "GE Healthcare",
  noi_san_xuat: "USA",
  nam_san_xuat: 2020,
  ngay_nhap: "2020-01-01",
  ngay_dua_vao_su_dung: "2020-02-01",
  nguon_kinh_phi: "Ngân sách",
  gia_goc: 500000000,
  nam_tinh_hao_mon: 10,
  ty_le_hao_mon: "10%",
  han_bao_hanh: "2023-01-01",
  vi_tri_lap_dat: "Phòng khám 1",
  nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
  khoa_phong_quan_ly: "Khoa Nội",
  tinh_trang_hien_tai: "Hoạt động",
  ghi_chu: "",
  chu_ky_bt_dinh_ky: 90,
  ngay_bt_tiep_theo: "2024-03-01",
  chu_ky_hc_dinh_ky: 365,
  ngay_hc_tiep_theo: "2024-12-01",
  chu_ky_kd_dinh_ky: 365,
  ngay_kd_tiep_theo: "2024-12-01",
  phan_loai_theo_nd98: "Loại B",
}

export function renderQRActionSheet(qrCode = "TB-001") {
  return render(<QRActionSheet qrCode={qrCode} onClose={mockOnClose} onAction={mockOnAction} />)
}

export const mockOnClose = vi.fn()
export const mockOnAction = vi.fn()
