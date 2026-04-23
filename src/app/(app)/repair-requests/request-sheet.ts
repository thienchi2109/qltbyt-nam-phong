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
  derived: { completionDateValue: string },
): string {
  const { organizationName, logoUrl } = branding
  const { day, month, year } = date
  const { completionDateValue } = derived
  const eq = request.thiet_bi!

  return `
    <div class="a4-page">
        <!-- Navy Header Banner -->
        <header class="header-banner">
            <div class="header-logo-container">
                <img src="${logoUrl}" alt="Logo"
                     onerror="this.onerror=null;this.src='${LOGO_FALLBACK}';">
            </div>
            <div class="header-text-container">
                <div class="header-org-name">${organizationName}</div>
                <h1 class="header-title">PHIẾU ĐỀ NGHỊ SỬA CHỮA THIẾT BỊ</h1>
                <div class="header-gold-line-bottom"></div>
            </div>
        </header>

        <!-- Content Body -->
        <div class="content-body">
            <!-- Department -->
            <div class="dept-row">
                <span class="dept-label">Khoa/Phòng đề nghị:</span>
                <div class="dept-value">${formatValue(eq.khoa_phong_quan_ly)}</div>
            </div>

            <!-- Section 1: Thông tin thiết bị -->
            <section style="margin-bottom: 24px;">
                <div class="section-header">
                    <div class="section-bullet"></div>
                    <h3 class="section-title">1. THÔNG TIN THIẾT BỊ</h3>
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
            </section>

            <!-- Section 2: Đề nghị sửa chữa -->
            <section style="margin-bottom: 24px;">
                <div class="section-header">
                    <div class="section-bullet"></div>
                    <h3 class="section-title">2. ĐỀ NGHỊ SỬA CHỮA</h3>
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
                    <div class="completion-value dotted-gold">
                        <input type="date" class="date-input" value="${completionDateValue}">
                    </div>
                </div>
            </section>

            <!-- Date & Signatures I -->
            <div style="margin-top: 24px; margin-bottom: 24px;">
                ${buildDateLine(day, month, year)}
                <div class="signature-layout">
                    <div class="signature-row signature-row-top">
                        <div class="signature-col">
                            <span class="sig-title">PHÒNG VT-TBYT</span>
                            <div class="sig-space"></div>
                            <div class="sig-line"></div>
                        </div>
                        <div class="signature-col">
                            <span class="sig-title">LÃNH ĐẠO KHOA/PHÒNG</span>
                            <div class="sig-space"></div>
                            <div class="sig-line"></div>
                        </div>
                        <div class="signature-col">
                            <span class="sig-title">NGƯỜI ĐỀ NGHỊ</span>
                            <div class="sig-space"></div>
                            <span class="sig-name">${formatValue(request.nguoi_yeu_cau)}</span>
                        </div>
                    </div>
                    <div class="signature-row signature-row-bottom">
                        <div class="signature-col">
                            <span class="sig-title">BAN GIÁM ĐỐC</span>
                            <div class="sig-space"></div>
                            <div class="sig-line"></div>
                        </div>
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

  const derived = {
    completionDateValue: request.ngay_mong_muon_hoan_thanh
      ? format(parseISO(request.ngay_mong_muon_hoan_thanh), 'yyyy-MM-dd')
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
</body>
</html>
  `
}
