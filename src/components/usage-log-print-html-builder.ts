import { format } from "date-fns"
import { vi } from "date-fns/locale"

import {
  type BuildUsageLogPrintHtmlArgs,
  escapeHtml,
  escapeUrl,
  formatDateInputForPrint,
  formatUsageDuration,
  getPrintableFinalStatus,
  getPrintableInitialStatus,
} from "@/components/usage-log-print-builder-utils"

export function buildUsageLogPrintHtml({
  equipment,
  filteredLogs,
  tenantName,
  tenantLogoUrl,
  dateFrom,
  dateTo,
  now,
}: BuildUsageLogPrintHtmlArgs): string {
  const currentDate = format(now, "dd/MM/yyyy HH:mm", { locale: vi })
  const dateRange = dateFrom || dateTo
    ? `(${dateFrom ? formatDateInputForPrint(dateFrom) : "..."} - ${dateTo ? formatDateInputForPrint(dateTo) : "..."})`
    : ""

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Nhật ký sử dụng thiết bị - ${escapeHtml(equipment.ten_thiet_bi)}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 1cm;
        }
        body {
          font-family: 'Times New Roman', serif;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
          padding: 0;
          color: #000;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .header-content {
          flex-grow: 1;
          text-align: center;
        }
        .header-logo {
          width: 80px;
          height: 80px;
        }
        .header-spacer {
          width: 80px;
          height: 80px;
        }
        .content-body {
          padding-bottom: 30px;
        }
        .header h1 {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 5px 0;
          text-transform: uppercase;
        }
        .header h2 {
          font-size: 18px;
          margin: 0 0 5px 0;
        }
        .equipment-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
          padding: 10px;
          border: 1px solid #ccc;
          background-color: #f9f9f9;
        }
        .info-item {
          display: flex;
          margin-bottom: 5px;
        }
        .info-label {
          font-weight: bold;
          min-width: 120px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .data-table th,
        .data-table td {
          border: 1px solid #000;
          padding: 6px 4px;
          text-align: left;
          vertical-align: top;
          font-size: 13px;
        }
        .data-table th {
          background-color: #f0f0f0;
          font-weight: bold;
          text-align: center;
        }
        .data-table td:nth-child(1) { width: 5%; }
        .data-table td:nth-child(2) { width: 14%; }
        .data-table td:nth-child(3) { width: 11%; }
        .data-table td:nth-child(4) { width: 11%; }
        .data-table td:nth-child(5) { width: 9%; }
        .data-table td:nth-child(6) { width: 14%; }
        .data-table td:nth-child(7) { width: 14%; }
        .data-table td:nth-child(8) { width: 8%; }
        .data-table td:nth-child(9) { width: 14%; }
        .footer {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
        }
        .signature-section {
          text-align: center;
        }
        .signature-title {
          font-weight: bold;
          margin-bottom: 50px;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 50px;
          padding-top: 5px;
        }
        .print-info {
          font-size: 11px;
          color: #666;
          text-align: right;
          margin-top: 20px;
        }
        .status-completed { color: #059669; }
        .status-active { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="content-body">
        <div class="header">
          <img src="${escapeUrl(tenantLogoUrl)}" alt="Logo" class="header-logo" onerror="this.onerror=null;this.style.display='none';">
          <div class="header-content">
            <h2 style="font-size: 14px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase;">${escapeHtml(tenantName)}</h2>
            <h1>NHẬT KÝ SỬ DỤNG THIẾT BỊ</h1>
            <h2>${escapeHtml(equipment.ten_thiet_bi)}</h2>
            <div>Mã thiết bị: ${escapeHtml(equipment.ma_thiet_bi)} ${dateRange}</div>
          </div>
          <div class="header-spacer"></div>
        </div>
        <div class="equipment-info">
          <div>
            <div class="info-item">
              <span class="info-label">Tên thiết bị:</span>
              <span>${escapeHtml(equipment.ten_thiet_bi)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Mã thiết bị:</span>
              <span>${escapeHtml(equipment.ma_thiet_bi)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Khoa/Phòng:</span>
              <span>${escapeHtml(equipment.khoa_phong_quan_ly) || "Chưa xác định"}</span>
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Hãng sản xuất:</span>
              <span>${escapeHtml(equipment.hang_san_xuat) || "Chưa có thông tin"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Model:</span>
              <span>${escapeHtml(equipment.model) || "Chưa có thông tin"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tình trạng hiện tại:</span>
              <span>${escapeHtml(equipment.tinh_trang_hien_tai) || "Chưa xác định"}</span>
            </div>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Người sử dụng</th>
              <th>Thời gian bắt đầu</th>
              <th>Thời gian kết thúc</th>
              <th>Thời lượng</th>
              <th>Tình trạng ban đầu</th>
              <th>Tình trạng kết thúc</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLogs.map((log, index) => `
              <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${escapeHtml(log.nguoi_su_dung?.full_name) || "Không xác định"}</td>
                <td>${format(new Date(log.thoi_gian_bat_dau), "dd/MM/yyyy HH:mm", { locale: vi })}</td>
                <td>${log.thoi_gian_ket_thuc ? format(new Date(log.thoi_gian_ket_thuc), "dd/MM/yyyy HH:mm", { locale: vi }) : "-"}</td>
                <td>${formatUsageDuration(log.thoi_gian_bat_dau, log.thoi_gian_ket_thuc, now)}</td>
                <td>${escapeHtml(getPrintableInitialStatus(log)) || "-"}</td>
                <td>${escapeHtml(getPrintableFinalStatus(log)) || "-"}</td>
                <td class="${log.trang_thai === "dang_su_dung" ? "status-active" : "status-completed"}">
                  ${log.trang_thai === "dang_su_dung" ? "Đang sử dụng" : "Hoàn thành"}
                </td>
                <td>${escapeHtml(log.ghi_chu) || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="footer">
          <div class="signature-section">
            <div class="signature-title">Người lập báo cáo</div>
            <div class="signature-line">Ký tên</div>
          </div>
          <div class="signature-section">
            <div class="signature-title">Phụ trách thiết bị</div>
            <div class="signature-line">Ký tên</div>
          </div>
        </div>
        <div class="print-info">
          In ngày: ${currentDate} | Tổng số bản ghi: ${filteredLogs.length}
        </div>
      </div>
    </body>
    </html>
  `
}
