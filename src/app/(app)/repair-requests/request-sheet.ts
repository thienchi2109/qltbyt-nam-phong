import { format, parseISO } from 'date-fns'
import type { RepairRequestWithEquipment } from './types'
import { REPAIR_SHEET_STYLES } from './request-sheet-styles'

export type RepairRequestSheetBranding = {
  organizationName: string
  logoUrl: string
}

/* ── Shared helpers ── */

const formatValue = (value: unknown) => (value ?? '')

const LOGO_FALLBACK = "https://placehold.co/70x70/ebeeef/ebeeef?text=Logo"

function buildDateLine(day: string, month: string, year: string): string {
  return `<div class="date-line">Cần Thơ, ngày ${day} tháng ${month} năm ${year}</div>`
}

function buildSignatureBlock(
  leftTitle: string,
  rightTitle: string,
  rightName: string,
  extraHeight?: string,
): string {
  const h = extraHeight ?? '80px'
  return `
    <div class="signature-row">
        <div class="signature-col">
            <span class="font-bold">${leftTitle}</span>
            <span class="signature-subtitle">(Ký và ghi rõ họ tên)</span>
            <div class="signature-space" style="height: ${h};"></div>
        </div>
        <div class="signature-col">
            <span class="font-bold">${rightTitle}</span>
            <span class="signature-subtitle">(Ký và ghi rõ họ tên)</span>
            <div class="signature-space" style="height: ${h};"></div>
            ${rightName ? `<span class="signature-name">${rightName}</span>` : ''}
        </div>
    </div>`
}

/* ── Page 1: Phiếu đề nghị ── */

function buildPage1(
  request: RepairRequestWithEquipment,
  branding: RepairRequestSheetBranding,
  date: { day: string; month: string; year: string },
  derived: { isNoiBo: boolean; isThueNgoai: string | false; tbytOpinion: string; completionDate: string },
): string {
  const { organizationName, logoUrl } = branding
  const { day, month, year } = date
  const { isNoiBo, isThueNgoai, tbytOpinion, completionDate } = derived
  const eq = request.thiet_bi!

  return `
    <div class="a4-page">
        <!-- Header Table -->
        <div class="grid-border mb-neg">
            <div class="grid-row grid-row-header" style="align-items: center;">
                <div class="cell text-center cell-border-r" style="justify-content: center;">
                    <img src="${logoUrl}" alt="Logo" class="logo-img"
                         onerror="this.onerror=null;this.src='${LOGO_FALLBACK}';">
                </div>
                <div class="cell text-center" style="flex-direction: column; justify-content: center;">
                    <div class="title-org uppercase">${organizationName}</div>
                    <div class="title-main uppercase">PHIẾU ĐỀ NGHỊ SỬA CHỮA THIẾT BỊ</div>
                </div>
                <div class="cell cell-border-l italic" style="font-size: 13px;">
                    Mã phiếu: ___________
                </div>
            </div>
        </div>

        <!-- Department -->
        <div class="grid-border mb-6">
            <div class="grid-row grid-row-dept">
                <div class="cell cell-label">Khoa/Phòng đề nghị:</div>
                <div class="cell cell-value uppercase">${formatValue(eq.khoa_phong_quan_ly)}</div>
            </div>
        </div>

        <!-- Section I Header -->
        <div class="mb-neg">
            <div class="grid-border-t grid-border-l grid-border-r text-center">
                <div class="section-title">I. THÔNG TIN THIẾT BỊ</div>
            </div>
        </div>

        <!-- Section I Data Grid -->
        <div class="grid-border">
            <div class="grid-row grid-row-2col">
                <div class="cell cell-label cell-border-b">Tên thiết bị</div>
                <div class="cell cell-value cell-border-b">${formatValue(eq.ten_thiet_bi)}</div>
            </div>
            <div class="grid-row grid-row-6col">
                <div class="cell cell-label cell-border-b cell-border-r">Mã TB</div>
                <div class="cell cell-value cell-border-b cell-border-r">${formatValue(eq.ma_thiet_bi)}</div>
                <div class="cell cell-label cell-border-b cell-border-r">Model</div>
                <div class="cell cell-value cell-border-b cell-border-r">${formatValue(eq.model)}</div>
                <div class="cell cell-label cell-border-b cell-border-r">Serial N⁰</div>
                <div class="cell cell-value cell-border-b">${formatValue(eq.serial)}</div>
            </div>
            <div class="grid-row grid-row-2col">
                <div class="cell cell-label cell-border-b cell-tall">Mô tả sự cố của thiết bị</div>
                <div class="cell cell-value cell-border-b cell-tall">${formatValue(request.mo_ta_su_co)}</div>
            </div>
            <div class="grid-row grid-row-2col">
                <div class="cell cell-label cell-border-b cell-tall">Các hạng mục yêu cầu sửa chữa</div>
                <div class="cell cell-value cell-border-b cell-tall">${formatValue(request.hang_muc_sua_chua)}</div>
            </div>
            <div class="grid-row grid-row-2col">
                <div class="cell cell-label">Ngày mong muốn hoàn thành</div>
                <div class="cell cell-value">${completionDate}</div>
            </div>
        </div>

        <!-- Date & Signatures I -->
        <div class="mt-8">
            ${buildDateLine(day, month, year)}
            ${buildSignatureBlock('Lãnh đạo Khoa/phòng', 'Người đề nghị', String(formatValue(request.nguoi_yeu_cau)))}
        </div>

        <!-- Section II Header -->
        <div class="mt-6 mb-neg">
            <div class="grid-border-t grid-border-l grid-border-r">
                <div class="section-title-dark">II. BỘ PHẬN SỬA CHỮA</div>
            </div>
        </div>

        <!-- Section II Data Grid -->
        <div class="grid-border">
            <div class="grid-row grid-row-2col">
                <div class="cell cell-label cell-border-b">Đánh giá</div>
                <div class="cell cell-value cell-border-b">
                    <div class="checkbox-group">
                        <label class="checkbox-label">
                            <span class="checkbox-box">${isNoiBo ? 'X' : ''}</span>
                            Tự sửa chữa được
                        </label>
                        <label class="checkbox-label">
                            <span class="checkbox-box">${isThueNgoai ? 'X' : ''}</span>
                            Không tự sửa chữa được
                        </label>
                    </div>
                </div>
            </div>
            <div class="grid-row grid-row-2col">
                <div class="cell cell-label cell-tall">Ý kiến Tổ Quản lý TBYT</div>
                <div class="cell cell-value cell-tall">${tbytOpinion}</div>
            </div>
        </div>

        <!-- Signatures II -->
        ${buildSignatureBlock('Tổ Quản lý TBYT', 'Người sửa chữa', '', '96px')}
    </div>`
}

/* ── Page 2: Kết quả xử lý ── */

function buildPage2(
  request: RepairRequestWithEquipment,
  branding: RepairRequestSheetBranding,
  date: { day: string; month: string; year: string },
): string {
  const { organizationName, logoUrl } = branding
  const { day, month, year } = date

  return `
    <div class="a4-page page-break">
        <!-- Header -->
        <div class="grid-border mb-6">
            <div class="grid-row" style="grid-template-columns: 100px 1fr; align-items: center;">
                <div class="cell text-center cell-border-r" style="justify-content: center;">
                    <img src="${logoUrl}" alt="Logo" class="logo-img"
                         onerror="this.onerror=null;this.src='${LOGO_FALLBACK}';">
                </div>
                <div class="cell text-center" style="flex-direction: column; justify-content: center;">
                    <div class="title-org uppercase">${organizationName}</div>
                </div>
            </div>
        </div>

        <!-- Section III Header -->
        <div class="mb-neg">
            <div class="grid-border-t grid-border-l grid-border-r">
                <div class="section-title">III. KẾT QUẢ, TÌNH TRẠNG THIẾT BỊ SAU KHI XỬ LÝ</div>
            </div>
        </div>

        <!-- Section III Content -->
        <div class="grid-border">
            <div class="cell cell-value" style="padding: 12px;">
                <textarea class="result-textarea" rows="5">${request.ket_qua_sua_chua || request.ly_do_khong_hoan_thanh || ''}</textarea>
            </div>
        </div>

        <!-- Date & Signatures -->
        <div class="mt-8">
            ${buildDateLine(day, month, year)}
            ${buildSignatureBlock('Tổ Quản lý TBYT', 'Người đề nghị', String(formatValue(request.nguoi_yeu_cau)))}
        </div>
    </div>`
}

/* ── Main entry point ── */

export function buildRepairRequestSheetHtml(
  request: RepairRequestWithEquipment,
  branding: RepairRequestSheetBranding,
): string {
  if (!request || !request.thiet_bi) {
    throw new Error('Không đủ thông tin để tạo phiếu yêu cầu.')
  }

  const requestDate = request.ngay_yeu_cau ? parseISO(request.ngay_yeu_cau) : new Date()
  const date = {
    day: format(requestDate, 'dd'),
    month: format(requestDate, 'MM'),
    year: format(requestDate, 'yyyy'),
  }

  const isNoiBo = request.don_vi_thuc_hien === 'noi_bo'
  const isThueNgoai = request.don_vi_thuc_hien === 'thue_ngoai' && (request.ten_don_vi_thue ?? false)
  const derived = {
    isNoiBo,
    isThueNgoai,
    tbytOpinion: isNoiBo
      ? 'Tự sửa chữa nội bộ'
      : isThueNgoai
        ? `Thuê đơn vị ${request.ten_don_vi_thue} sửa chữa`
        : '',
    completionDate: request.ngay_mong_muon_hoan_thanh
      ? format(parseISO(request.ngay_mong_muon_hoan_thanh), 'dd/MM/yyyy')
      : '',
  }

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phiếu Đề Nghị Sửa Chữa - ${formatValue(request.thiet_bi.ma_thiet_bi)}</title>
    <style>${REPAIR_SHEET_STYLES}</style>
</head>
<body>
    ${buildPage1(request, branding, date, derived)}
    ${buildPage2(request, branding, date)}
</body>
</html>
  `
}
