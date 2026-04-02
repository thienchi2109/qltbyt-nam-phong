import { format, parseISO } from 'date-fns'
import type { RepairRequestWithEquipment } from './types'
import { REPAIR_SHEET_STYLES } from './request-sheet-styles'

export type RepairRequestSheetBranding = {
  organizationName: string
  logoUrl: string
}

/* ── Shared helpers ── */

const formatValue = (value: unknown) => (value ?? '')

const LOGO_FALLBACK = "https://placehold.co/58x58/ebeeef/ebeeef?text=Logo"

function buildDateLine(day: string, month: string, year: string): string {
  return `<div class="date-line">Cần Thơ, ngày ${day} tháng ${month} năm ${year}</div>`
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
        <!-- Navy Header Banner -->
        <header class="header-banner">
            <div class="header-logo-circle">
                <img src="${logoUrl}" alt="Logo"
                     onerror="this.onerror=null;this.src='${LOGO_FALLBACK}';">
            </div>
            <div class="header-org-name">${organizationName}</div>
            <div class="header-gold-line"></div>
            <h1 class="header-title">PHIẾU ĐỀ NGHỊ SỬA CHỮA THIẾT BỊ</h1>
            <div class="header-gold-line-bottom"></div>
        </header>

        <!-- Content Body -->
        <div class="content-body">
            <!-- Department -->
            <div class="dept-row">
                <span class="dept-label">Khoa/Phòng đề nghị:</span>
                <div class="dept-value">${formatValue(eq.khoa_phong_quan_ly)}</div>
            </div>

            <!-- Section I: Thông tin thiết bị -->
            <section style="margin-bottom: 36px;">
                <div class="section-header">
                    <div class="section-bullet"></div>
                    <h3 class="section-title">I. THÔNG TIN THIẾT BỊ</h3>
                </div>

                <div class="field-row">
                    <span class="field-label">Tên thiết bị:</span>
                    <div class="field-value dotted-gold">${formatValue(eq.ten_thiet_bi)}</div>
                </div>

                <div class="info-strip">
                    <div class="info-cell">
                        <span class="info-label">Mã TB:</span>
                        <span>${formatValue(eq.ma_thiet_bi)}</span>
                    </div>
                    <div class="info-cell">
                        <span class="info-label">Model:</span>
                        <span>${formatValue(eq.model)}</span>
                    </div>
                    <div class="info-cell">
                        <span class="info-label">Serial N⁰:</span>
                        <span>${formatValue(eq.serial)}</span>
                    </div>
                </div>

                <div>
                    <label style="display: block; font-weight: 700; margin-bottom: 8px;">Mô tả sự cố của thiết bị:</label>
                    <div class="text-block">${formatValue(request.mo_ta_su_co)}</div>
                </div>

                <div>
                    <label style="display: block; font-weight: 700; margin-bottom: 8px;">Các hạng mục yêu cầu sửa chữa:</label>
                    <div class="text-block">${formatValue(request.hang_muc_sua_chua)}</div>
                </div>

                <div class="completion-row">
                    <span class="completion-label">Ngày mong muốn hoàn thành (nếu có):</span>
                    <div class="completion-value dotted-gold">${completionDate}</div>
                </div>
            </section>

            <!-- Date & Signatures I -->
            <div style="margin-top: 28px; margin-bottom: 40px;">
                ${buildDateLine(day, month, year)}
                <div class="signature-row">
                    <div class="signature-col">
                        <span class="sig-title">Lãnh đạo Khoa/phòng</span>
                        <div class="sig-line"></div>
                    </div>
                    <div class="signature-col">
                        <span class="sig-title" style="margin-bottom: 16px;">Người đề nghị</span>
                        <div style="height: 56px;"></div>
                        <span class="sig-name">${formatValue(request.nguoi_yeu_cau)}</span>
                    </div>
                </div>
            </div>

            <!-- Gold Divider -->
            <div class="gold-divider"></div>

            <!-- Section II: Bộ phận sửa chữa -->
            <section>
                <div class="section-header">
                    <div class="section-bullet"></div>
                    <h3 class="section-title">II. BỘ PHẬN SỬA CHỮA</h3>
                </div>

                <div class="checkbox-row">
                    <label class="checkbox-item">
                        <div class="checkbox-box">
                            ${isNoiBo ? '<div class="checkbox-fill"></div>' : ''}
                        </div>
                        <span>Tự sửa chữa được</span>
                    </label>
                    <label class="checkbox-item">
                        <div class="checkbox-box">
                            ${isThueNgoai ? '<div class="checkbox-fill"></div>' : ''}
                        </div>
                        <span>Không tự sửa chữa được</span>
                    </label>
                </div>

                <div class="opinion-row">
                    <span class="opinion-label">Ý kiến của Tổ Quản lý TBYT:</span>
                    <span class="opinion-value">${tbytOpinion}</span>
                    <div class="opinion-underline dotted-gold"></div>
                </div>

                <div class="signature-row" style="margin-top: 36px;">
                    <div class="signature-col">
                        <span class="sig-title">Tổ Quản lý TBYT</span>
                        <div class="sig-line"></div>
                    </div>
                    <div class="signature-col">
                        <span class="sig-title">Người sửa chữa</span>
                        <div class="sig-line"></div>
                    </div>
                </div>
            </section>
        </div>
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
        <!-- Navy Header (compact for Page 2) -->
        <header class="header-banner" style="padding: 28px 40px 24px;">
            <div class="header-logo-circle">
                <img src="${logoUrl}" alt="Logo"
                     onerror="this.onerror=null;this.src='${LOGO_FALLBACK}';">
            </div>
            <div class="header-org-name">${organizationName}</div>
            <div class="header-gold-line-bottom" style="margin-top: 12px;"></div>
        </header>

        <!-- Content Body -->
        <div class="content-body">
            <!-- Section III -->
            <section style="margin-bottom: 36px;">
                <div class="section-header">
                    <div class="section-bullet"></div>
                    <h3 class="section-title">III. KẾT QUẢ, TÌNH TRẠNG THIẾT BỊ SAU KHI XỬ LÝ</h3>
                </div>

                <textarea class="result-area" rows="6">${request.ket_qua_sua_chua || request.ly_do_khong_hoan_thanh || ''}</textarea>
            </section>

            <!-- Date & Signatures -->
            <div style="margin-top: 28px;">
                ${buildDateLine(day, month, year)}
                <div class="signature-row" style="margin-top: 16px;">
                    <div class="signature-col">
                        <span class="sig-title" style="margin-bottom: 4px;">Tổ Quản lý TBYT</span>
                        <span style="font-style: italic; font-size: 12px; color: #5a6061; margin-bottom: 48px;">(Ký, ghi rõ họ, tên)</span>
                        <div class="sig-line"></div>
                    </div>
                    <div class="signature-col">
                        <span class="sig-title" style="margin-bottom: 4px;">Người đề nghị</span>
                        <span style="font-style: italic; font-size: 12px; color: #5a6061;">(Ký, ghi rõ họ, tên)</span>
                        <div style="height: 48px;"></div>
                        <span class="sig-name">${formatValue(request.nguoi_yeu_cau)}</span>
                    </div>
                </div>
            </div>
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
