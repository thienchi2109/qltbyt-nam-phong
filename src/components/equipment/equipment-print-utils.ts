/**
 * equipment-print-utils.ts
 *
 * Utility functions for generating printable HTML documents for equipment.
 * - Profile Sheet: Full equipment details for documentation
 * - Device Label: Compact label with QR code for equipment tagging
 *
 * These are pure functions that open new browser windows with generated HTML.
 */

import type { Equipment } from "@/types/database"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import { callRpc } from "@/lib/rpc-client"
import { isGlobalRole } from "@/lib/rbac"

export interface PrintContext {
  tenantBranding: TenantBranding | null | undefined
  userRole: string | undefined
  equipmentTenantId: number | undefined
}

/**
 * Fetches tenant branding for a specific tenant ID.
 * Used when global/admin users need to print with equipment's tenant branding.
 */
async function fetchTenantBranding(tenantId: number): Promise<TenantBranding | null> {
  try {
    const res = await callRpc<TenantBranding[]>({
      fn: 'don_vi_branding_get',
      args: { p_id: tenantId }
    })
    const branding = res?.[0]
    if (branding && branding.name) {
      return branding
    }
  } catch (error) {
    console.error('Failed to fetch equipment tenant branding:', error)
  }
  return null
}

/**
 * Determines the appropriate branding to use for printing.
 * - Global/admin users: Use equipment's tenant branding
 * - Regular users: Use session tenant branding, fallback to equipment's tenant
 */
async function resolveBranding(context: PrintContext): Promise<TenantBranding | null> {
  const { tenantBranding, userRole, equipmentTenantId } = context

  // For global/admin users, ALWAYS use equipment's tenant branding
  if (isGlobalRole(userRole) && equipmentTenantId) {
    return await fetchTenantBranding(equipmentTenantId) || tenantBranding || null
  }

  // For regular users without tenant branding, try equipment tenant
  if (!tenantBranding && equipmentTenantId) {
    return await fetchTenantBranding(equipmentTenantId)
  }

  return tenantBranding || null
}

const formatValue = (value: unknown): string => (value as string) ?? ""

const formatCurrency = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return ""
  return Number(value).toLocaleString('vi-VN') + ' VNĐ'
}

/**
 * Generates and opens a Profile Sheet (Phiếu Lý Lịch Thiết Bị) in a new window.
 */
export async function generateProfileSheet(
  equipment: Equipment,
  context: PrintContext
): Promise<void> {
  if (!equipment) return

  const brandingToUse = await resolveBranding({
    ...context,
    equipmentTenantId: equipment.don_vi ?? undefined
  })

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Phiếu Lý Lịch Thiết Bị - ${formatValue(equipment.ma_thiet_bi)}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; background-color: #e5e7eb; line-height: 1.5; }
            .a4-page { width: 21cm; min-height: 29.7cm; padding: 1cm 2cm; margin: 1cm auto; background: white; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); position: relative; display: flex; flex-direction: column; }
            .content-body { flex-grow: 1; }
            .form-input-line { font-family: inherit; font-size: inherit; border: none; border-bottom: 1px dotted #000; background-color: transparent; padding: 1px; outline: none; width: 100%; }
            h1, h2, .font-bold { font-weight: 700; }
            .title-main { font-size: 20px; }
            .title-sub { font-size: 16px; }
            .form-section { border: 1px solid #000; padding: 8px; }
            .long-text { white-space: pre-wrap; word-break: break-word; min-height: 22px; }
            .signature-box { border: 1px solid #000; border-top: none; }
            .signature-area { text-align: center; padding: 12px; }
            .signature-space { height: 80px; }
            .signature-name-input { border: none; background-color: transparent; text-align: center; font-weight: 700; width: 100%; margin-top: 8px; }
            .signature-name-input:focus { outline: none; }
            @media print {
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #fff !important; }
                .a4-page { display: block !important; width: auto; height: auto; min-height: 0; margin: 0 !important; padding: 1cm 2cm !important; box-shadow: none !important; border: none !important; }
                body > *:not(.a4-page) { display: none; }
                .print-footer { position: fixed; bottom: 1cm; left: 2cm; right: 2cm; width: calc(100% - 4cm); }
                .content-body { padding-bottom: 3cm; }
                .form-section, .signature-box, header { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="a4-page">
            <div class="content-body">
                <header class="text-center">
                    <div class="flex justify-between items-center">
                        <img src="${brandingToUse?.logo_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo'}" alt="Logo ${brandingToUse?.name || 'Organization'}" class="w-20 h-20" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                        <div class="flex-grow">
                            <h2 class="title-sub uppercase font-bold text-xl">${brandingToUse?.name || 'ĐƠN VỊ'}</h2>
                            <div class="flex items-baseline justify-center mt-2">
                                <label class="font-bold whitespace-nowrap">KHOA/PHÒNG:</label>
                                <div class="w-1/2 ml-2"><input type="text" class="form-input-line" value="${formatValue(equipment.khoa_phong_quan_ly)}"></div>
                            </div>
                        </div>
                    </div>
                </header>
                <main class="mt-4">
                    <div class="form-section">
                        <h1 class="title-main uppercase font-bold text-center">PHIẾU LÝ LỊCH THIẾT BỊ</h1>
                    </div>
                    <div class="form-section border-t-0">
                        <div class="flex items-baseline">
                            <label class="whitespace-nowrap w-28">1. Tên thiết bị:</label>
                            <input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ten_thiet_bi)}">
                        </div>
                         <div class="grid grid-cols-2 gap-x-8 mt-2">
                            <div class="flex items-baseline">
                               <label class="whitespace-nowrap w-28">Mã số TB:</label>
                               <input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ma_thiet_bi)}">
                            </div>
                             <div class="flex items-baseline">
                               <label class="whitespace-nowrap">Mã số TB ban đầu:</label>
                               <input type="text" class="form-input-line ml-2" value="">
                            </div>
                        </div>
                    </div>
                    <div class="form-section border-t-0">
                        <div class="grid grid-cols-2 gap-x-8">
                            <div class="flex items-baseline"><label class="w-28">2. Model:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.model)}"></div>
                            <div class="flex items-baseline"><label class="w-36">7. Ngày nhập:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ngay_nhap)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-28">3. Serial N⁰:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.serial)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-36">8. Ngày đưa vào sử dụng:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.ngay_dua_vao_su_dung)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-28">4. Hãng SX:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.hang_san_xuat)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-36">9. Vị trí lắp đặt:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.vi_tri_lap_dat)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-28">5. Nơi SX:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.noi_san_xuat)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-36">10. Giá gốc:</label><input type="text" class="form-input-line ml-2" value="${formatCurrency(equipment.gia_goc)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-28">6. Năm SX:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.nam_san_xuat)}"></div>
                            <div class="flex items-baseline mt-2"><label class="w-36">11. Nguồn kinh phí:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.nguon_kinh_phi)}"></div>
                        </div>
                    </div>
                    <div class="form-section border-t-0">
                        <div class="flex items-center">
                            <label class="whitespace-nowrap">12. Bảo hành:</label>
                            <div class="ml-10 flex items-center gap-x-10">
                                 <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2" ${!equipment.han_bao_hanh ? 'checked' : ''}>Không</label>
                                 <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2" ${equipment.han_bao_hanh ? 'checked' : ''}>Có ( Ngày BH cuối cùng: <span class="inline-block w-48 ml-2"><input type="text" class="form-input-line" value="${formatValue(equipment.han_bao_hanh)}"></span>)</label>
                            </div>
                        </div>
                    </div>
                     <div class="form-section border-t-0">
                        <div class="flex items-center">
                            <label class="whitespace-nowrap">13. Hiệu chuẩn thiết bị:</label>
                            <div class="ml-10 flex items-center gap-x-10">
                                 <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Không cần</label>
                                 <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Cần hiệu chuẩn</label>
                            </div>
                        </div>
                    </div>
                    <div class="form-section border-t-0">
                        <div class="flex items-baseline"><label class="whitespace-nowrap">14. Cấu hình thiết bị:</label>
                            <div class="form-input-line long-text ml-2">${formatValue(equipment.cau_hinh_thiet_bi)}</div>
                        </div>
                    </div>
                     <div class="form-section border-t-0">
                         <div class="flex items-baseline"><label class="whitespace-nowrap">15. Phụ kiện kèm theo:</label>
                            <div class="form-input-line long-text ml-2">${formatValue(equipment.phu_kien_kem_theo)}</div>
                        </div>
                    </div>
                    <div class="form-section border-t-0">
                         <div class="flex items-center">
                            <label class="whitespace-nowrap">16. Tình trạng khi nhận:</label>
                            <div class="ml-10 flex items-center gap-x-10">
                                 <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Mới 100%</label>
                                 <label class="flex items-center"><input type="checkbox" class="h-4 w-4 mr-2">Thiết bị cũ ( phần trăm còn lại: <span class="inline-block w-24 ml-2"><input type="text" class="form-input-line"></span>%)</label>
                            </div>
                        </div>
                    </div>
                     <div class="form-section border-t-0">
                        <div class="flex items-baseline"><label class="whitespace-nowrap">17. Tình trạng thiết bị hiện tại:</label><input type="text" class="form-input-line ml-2" value="${formatValue(equipment.tinh_trang_hien_tai)}"></div>
                    </div>
                    <div class="signature-box">
                        <div class="flex">
                            <div class="w-1/2 signature-area border-r border-gray-400">
                                <!-- Thêm khoảng trống để căn chỉnh với dòng ngày tháng bên phải -->
                                <div class="h-12">&nbsp;</div>
                                <p class="font-bold">Lãnh đạo khoa/ phòng</p>
                                <p class="italic">(Ký, ghi rõ họ và tên)</p>
                                <div class="signature-space"></div>
                                <input type="text" class="signature-name-input" placeholder="(Họ và tên)">
                            </div>
                            <div class="w-1/2 signature-area">
                                <div class="text-center pt-2 h-12">
                                    <p class="italic whitespace-nowrap">
                                        <span class="inline-block w-24"><input type="text" class="form-input-line text-center italic" value="Cần Thơ"></span>, ngày
                                        <span class="inline-block w-8"><input type="text" class="form-input-line text-center"></span> tháng
                                        <span class="inline-block w-8"><input type="text" class="form-input-line text-center"></span> năm
                                        <span class="inline-block w-8"><input type="text" class="form-input-line text-center"></span>
                                    </p>
                                </div>
                                <p class="font-bold">Người trực tiếp quản lý</p>
                                <p class="italic">(Ký, ghi rõ họ và tên)</p>
                                <div class="signature-space"></div>
                                <input type="text" class="signature-name-input" value="${formatValue(equipment.nguoi_dang_truc_tiep_quan_ly)}">
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </body>
    </html>
  `

  const newWindow = window.open("", "_blank")
  if (newWindow) {
    newWindow.document.open()
    newWindow.document.write(htmlContent)
    newWindow.document.close()
  }
}

/**
 * Generates and opens a Device Label (Nhãn Thiết Bị) in a new window.
 */
export async function generateDeviceLabel(
  equipment: Equipment,
  context: PrintContext
): Promise<void> {
  if (!equipment) return

  const brandingToUse = await resolveBranding({
    ...context,
    equipmentTenantId: equipment.don_vi ?? undefined
  })

  const qrText = formatValue(equipment.ma_thiet_bi)
  const qrSize = 112
  const qrUrl = qrText
    ? `https://quickchart.io/qr?text=${encodeURIComponent(qrText)}&caption=${encodeURIComponent(qrText)}&captionFontFamily=mono&captionFontSize=12&size=${qrSize}&ecLevel=H&margin=2`
    : `https://placehold.co/${qrSize}x${qrSize}/ffffff/cccccc?text=QR+Code`

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nhãn Thiết Bị - ${formatValue(equipment.ma_thiet_bi)}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Roboto Slab', serif; }
            .form-input-line { border-bottom: 1px dotted #333; width: 100%; min-height: 24px; padding: 1px 0.25rem; }
            .long-text-label { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
            @media print {
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #fff !important; margin: 0; }
                .label-container { box-shadow: none !important; border: 3px double #000 !important; margin: 0; page-break-inside: avoid; }
                body > *:not(.label-container) { display: none; }
            }
        </style>
    </head>
    <body class="bg-gray-200 flex items-center justify-center min-h-screen p-4">
        <div class="w-full max-w-md bg-white p-4 shadow-lg label-container" style="border: 3px double #000;">
            <header class="flex items-start justify-between gap-3 border-b-2 border-black pb-3">
                <div class="flex-shrink-0">
                    <img src="${brandingToUse?.logo_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo'}" alt="Logo ${brandingToUse?.name || 'Organization'}" class="w-16 h-auto" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                </div>
                <div class="text-center flex-grow">
                    <h1 class="text-2xl font-bold tracking-wider">NHÃN THIẾT BỊ</h1>
                    <div class="flex items-baseline mt-2">
                        <label class="text-base font-semibold whitespace-nowrap">Khoa:</label>
                        <div class="form-input-line ml-2 text-center uppercase">${formatValue(equipment.khoa_phong_quan_ly)}</div>
                    </div>
                </div>
            </header>
            <main class="mt-4 space-y-3">
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Tên thiết bị:</label>
                    <div class="form-input-line long-text-label flex-grow">${formatValue(equipment.ten_thiet_bi)}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Mã số TB:</label>
                    <div class="form-input-line">${formatValue(equipment.ma_thiet_bi)}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Model:</label>
                    <div class="form-input-line">${formatValue(equipment.model)}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Serial N⁰:</label>
                    <div class="form-input-line">${formatValue(equipment.serial)}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Ngày hiệu chuẩn:</label>
                    <div class="form-input-line">${formatValue(equipment.ngay_hc_tiep_theo)}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Ngày hết hạn:</label>
                    <div class="form-input-line"></div>
                </div>
                <div class="flex items-baseline">
                    <label class="text-base font-semibold w-40 shrink-0">Tình trạng hiện tại:</label>
                    <div class="form-input-line font-medium">${formatValue(equipment.tinh_trang_hien_tai)}</div>
                </div>
            </main>
            <div class="mt-4 flex items-center justify-between gap-4 border-t-2 border-gray-300 pt-3">
                <div class="flex flex-col items-center">
                     <label class="text-sm font-semibold">Mã QR của TB</label>
                     <img id="qr-image"
                         src="${qrUrl}"
                         alt="Mã QR của ${qrText}"
                         class="w-28 h-28 border rounded-md p-1 bg-white mt-1"
                         onerror="this.onerror=null;this.src='https://placehold.co/112x112/ffffff/cccccc?text=QR+Code';"
                     >
                </div>
            </div>
        </div>
    </body>
    </html>
  `

  const newWindow = window.open("", "_blank")
  if (newWindow) {
    newWindow.document.open()
    newWindow.document.write(htmlContent)
    newWindow.document.close()
  }
}
