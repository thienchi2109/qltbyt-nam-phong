import { format, parseISO } from 'date-fns'
import type { RepairRequestWithEquipment } from './types'

export type RepairRequestSheetBranding = {
  organizationName: string
  logoUrl: string
}

export function buildRepairRequestSheetHtml(
  request: RepairRequestWithEquipment,
  branding: RepairRequestSheetBranding,
): string {
  if (!request || !request.thiet_bi) {
    throw new Error('Không đủ thông tin để tạo phiếu yêu cầu.')
  }

  const formatValue = (value: unknown) => (value ?? '')

  const requestDate = request.ngay_yeu_cau ? parseISO(request.ngay_yeu_cau) : new Date()
  const day = format(requestDate, 'dd')
  const month = format(requestDate, 'MM')
  const year = format(requestDate, 'yyyy')

  const { organizationName, logoUrl } = branding

  return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Đề Nghị Sửa Chữa - ${formatValue(request.thiet_bi.ma_thiet_bi)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; line-height: 1.2; background-color: #e5e7eb; }
              .a4-page { width: 21cm; min-height: 29.7cm; padding: 1.5cm 2cm; margin: 1cm auto; background: white; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); position: relative; }
              .form-input-line { font-family: inherit; font-size: inherit; border: none; border-bottom: 1px dotted #000; background-color: transparent; padding: 2px 1px; outline: none; text-align: center; }
              .form-textarea { font-family: inherit; font-size: inherit; border: 1px dotted #000; background-color: transparent; padding: 8px; outline: none; width: 100%; resize: none; }
              .form-input-line:focus, .form-textarea:focus { border-style: solid; }
              h1, h2, h3, .font-bold { font-weight: 700; }
              .title-main { font-size: 20px; }
              .title-sub { font-size: 16px; }
              .signature-area { display: flex; flex-direction: column; align-items: center; }
              .signature-space { height: 65px; }
              .signature-name-input { border: none; background-color: transparent; text-align: center; font-weight: 700; width: 200px; }
              .signature-name-input:focus { outline: none; }
              .page-break { page-break-before: always; }
              .print-footer { position: absolute; bottom: 0; left: 0; right: 0; }
              @media print {
                  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #e5e7eb !important; }
                  .a4-page { width: 21cm !important; height: 29.7cm !important; margin: 0 !important; padding: 1.5cm 2cm !important; box-shadow: none !important; border: none !important; position: relative !important; }
                  .page-break { page-break-before: always !important; }
                  .print-footer { position: absolute !important; bottom: 1.5cm !important; left: 2cm !important; right: 2cm !important; width: calc(100% - 4cm) !important; }
                  body > *:not(.a4-page) { display: none; }
                  .form-input-line, .form-textarea, input[type="date"] { border-bottom: 1px dotted #000 !important; }
                  .signature-name-input { border: none !important; }
                  .form-textarea { border: 1px dotted #000 !important; }
              }
          </style>
      </head>
      <body>
          <div class="a4-page">
              <header class="text-center mb-8">
                  <div class="flex justify-between items-start">
                      <div class="text-center">
                          <img src="${logoUrl}" alt="Logo" class="w-[70px] mx-auto mb-1" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                      </div>
                      <div class="flex-grow">
                          <h2 class="title-sub uppercase font-bold">${organizationName}</h2>
                          <h1 class="title-main uppercase mt-4 font-bold">PHIẾU ĐỀ NGHỊ SỬA CHỮA THIẾT BỊ</h1>
                      </div>
                      <div class="w-16"></div> <!-- Spacer -->
                  </div>
                  <div class="flex items-baseline mt-6">
                      <label for="department-request" class="font-bold whitespace-nowrap">Khoa/Phòng đề nghị:</label>
                      <input type="text" id="department-request" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.khoa_phong_quan_ly)}">
                  </div>
              </header>
              <section>
                  <h3 class="font-bold text-base">I. THÔNG TIN THIẾT BỊ</h3>
                  <div class="space-y-4 mt-3">
                      <div>
                          <label for="device-name" class="whitespace-nowrap">Tên thiết bị:</label>
                          <input type="text" id="device-name" class="form-input-line ml-2 w-full" value="${formatValue(request.thiet_bi.ten_thiet_bi)}">
                      </div>
                      <div class="grid grid-cols-3 gap-x-8">
                          <div class="flex items-baseline">
                              <label for="device-id" class="whitespace-nowrap">Mã TB:</label>
                              <input type="text" id="device-id" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.ma_thiet_bi)}">
                          </div>
                          <div class="flex items-baseline">
                              <label for="model" class="whitespace-nowrap">Model:</label>
                              <input type="text" id="model" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.model)}">
                          </div>
                          <div class="flex items-baseline">
                              <label for="serial-no" class="whitespace-nowrap">Serial N⁰:</label>
                              <input type="text" id="serial-no" class="form-input-line ml-2" value="${formatValue(request.thiet_bi.serial)}">
                          </div>
                      </div>
                      <div>
                          <label for="damage-description" class="block">Mô tả sự cố của thiết bị:</label>
                          <textarea id="damage-description" rows="1" class="form-textarea mt-1">${formatValue(request.mo_ta_su_co)}</textarea>
                      </div>
                      <div>
                          <label for="repair-request" class="block">Các hạng mục yêu cầu sửa chữa:</label>
                          <textarea id="repair-request" rows="1" class="form-textarea mt-1">${formatValue(request.hang_muc_sua_chua)}</textarea>
                      </div>
                      <div class="flex items-baseline">
                          <label for="completion-date" class="whitespace-nowrap">Ngày mong muốn hoàn thành (nếu có):</label>
                          <input type="date" id="completion-date" class="form-input-line ml-2" value="${formatValue(request.ngay_mong_muon_hoan_thanh)}">
                      </div>
                      
                      
                  </div>
              </section>
              <div class="mt-8">
                  <div class="flex justify-end mb-4">
                      <p class="italic">Cần Thơ, ngày <input type="text" class="w-8 form-input-line inline-block text-center" value="${day}"> tháng <input type="text" class="w-8 form-input-line inline-block text-center" value="${month}"> năm <input type="text" class="w-12 form-input-line inline-block text-center" value="${year}"></p>
                  </div>
                  <div class="flex justify-around">
                      <div class="signature-area">
                          <p class="font-bold">Lãnh đạo Khoa/phòng</p>
                          <div class="signature-space"></div>
                          <input type="text" id="leader-name" class="signature-name-input">
                      </div>
                      <div class="signature-area">
                          <p class="font-bold">Người đề nghị</p>
                          <div class="signature-space"></div>
                          <input type="text" id="requester-name" class="signature-name-input" value="${formatValue(request.nguoi_yeu_cau)}">
                      </div>
                  </div>
              </div>
              <section class="mt-6 border-t-2 border-dashed border-gray-400 pt-6">
                  <h3 class="font-bold text-base">II. BỘ PHẬN SỬA CHỮA</h3>
                  <div class="mt-4 flex items-center space-x-10">
                      <label class="flex items-center">
                          <input type="checkbox" class="h-4 w-4">
                          <span class="ml-2">Tự sửa chữa được</span>
                      </label>
                      <label class="flex items-center">
                          <input type="checkbox" class="h-4 w-4">
                          <span class="ml-2">Không tự sửa chữa được</span>
                      </label>
                  </div>
                  <div class="mt-4">
                      <label for="tbyt-opinion" class="block">Ý kiến của Tổ Quản lý TBYT:</label>
                      <input type='text' id="tbyt-opinion" class="form-input-line ml-2 min-w-[400px]" value="${request.don_vi_thuc_hien === 'noi_bo' ? 'Tự sửa chữa nội bộ' : request.don_vi_thuc_hien === 'thue_ngoai' && request.ten_don_vi_thue ? `Thuê đơn vị ${request.ten_don_vi_thue} sửa chữa` : ''}">
                  </div>
              </section>
              <div class="mt-8 flex justify-around">
                  <div class="signature-area">
                      <p class="font-bold">Tổ Quản lý TBYT</p>
                      <div class="signature-space"></div>
                      <input type="text" id="tbyt-name" class="signature-name-input">
                  </div>
                  <div class="signature-area">
                      <p class="font-bold">Người sửa chữa</p>
                      <div class="signature-space"></div>
                      <input type="text" id="repairer-name" class="signature-name-input">
                  </div>
              </div>
          </div>

          <!-- Page 2: Repair Result Form -->
          <div class="a4-page page-break">
              <div class="content-body">
                  <!-- Header -->
                  <header class="text-center mb-8">
                      <div class="flex items-center">
                          <div class="text-center">
                              <img src="${logoUrl}" alt="Logo" class="w-[70px] mx-auto mb-1" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                          </div>
                          <div class="flex-grow">
                              <h2 class="title-sub uppercase font-bold">${organizationName}</h2>
                          </div>
                          <div class="w-16"></div> <!-- Spacer -->
                      </div>
                  </header>

                  <!-- Main Content -->
                  <main class="mt-8">
                      <h3 class="text-base font-bold">III. KẾT QUẢ, TÌNH TRẠNG THIẾT BỊ SAU KHI XỬ LÝ</h3>
                      <div class="mt-4">
                          <textarea class="form-textarea" rows="5" placeholder="Nhập kết quả và tình trạng thiết bị...">${request.ket_qua_sua_chua || request.ly_do_khong_hoan_thanh || ''}</textarea>
                      </div>
                  </main>

                  <!-- Signature section -->
                  <section class="mt-8">
                       <div class="flex justify-end mb-4">
                           <p class="italic">
                              Cần Thơ, ngày <input type="text" class="form-input-line w-12" value="${day}">
                              tháng <input type="text" class="form-input-line w-12" value="${month}">
                              năm <input type="text" class="form-input-line w-20" value="${year}">
                          </p>
                      </div>
                       <div class="flex justify-around">
                          <div class="signature-area w-1/2">
                              <p class="font-bold">Tổ Quản lý TBYT</p>
                              <p class="italic">(Ký, ghi rõ họ, tên)</p>
                              <div class="signature-space"></div>
                              <input type="text" class="signature-name-input" placeholder="(Họ và tên)">
                          </div>
                          <div class="signature-area w-1/2">
                               <p class="font-bold">Người đề nghị</p>
                               <p class="italic">(Ký, ghi rõ họ, tên)</p>
                               <div class="signature-space"></div>
                               <input type="text" class="signature-name-input" placeholder="(Họ và tên)" value="${formatValue(request.nguoi_yeu_cau)}">
                          </div>
                      </div>
                  </section>
              </div>

          </div>
      </body>
      </html>
    `
}
