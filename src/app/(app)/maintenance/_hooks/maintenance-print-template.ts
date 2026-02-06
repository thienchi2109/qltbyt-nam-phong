import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  return String(value)
}

export function buildPrintTemplate(params: {
  selectedPlan: MaintenancePlan
  tasks: MaintenanceTask[]
  user: { full_name?: string } | null
  logoUrl: string
  organizationName: string
}): string {
  const { selectedPlan, tasks, user, logoUrl, organizationName } = params

  const generateTableRows = () => {
    return tasks.map((task, index) => {
      const checkboxes = Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
        const fieldName = `thang_${month}` as keyof MaintenanceTask
        const isChecked = task[fieldName] ? 'checked' : ''
        return `<td><input type="checkbox" ${isChecked}></td>`
      }).join('')

      const noiBoChecked = task.don_vi_thuc_hien === 'Nội bộ' ? 'checked' : ''
      const thueNgoaiChecked = task.don_vi_thuc_hien === 'Thuê ngoài' ? 'checked' : ''

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${formatValue(task.thiet_bi?.ma_thiet_bi)}</td>
          <td>${formatValue(task.thiet_bi?.ten_thiet_bi)}</td>
          <td>${formatValue(task.thiet_bi?.khoa_phong_quan_ly)}</td>
          <td><input type="checkbox" ${noiBoChecked}></td>
          <td><input type="checkbox" ${thueNgoaiChecked}></td>
          ${checkboxes}
          <td><textarea class="auto-resize-textarea" rows="2" style="width: 100%; border: none; outline: none; background: transparent; resize: none; word-wrap: break-word; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; line-height: 1.2; padding: 4px; font-family: inherit; font-size: 10px; overflow: visible;">${formatValue(task.ghi_chu)}</textarea></td>
        </tr>
      `
    }).join('')
  }

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kế Hoạch ${selectedPlan.loai_cong_viec} Thiết Bị - ${selectedPlan.ten_ke_hoach}</title>
    <!-- Import Tailwind CSS for styling -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12px;
            color: #000;
            background-color: #e5e7eb;
            line-height: 1.4;
        }
        .a4-landscape-page {
            width: 29.7cm;
            min-height: 21cm;
            padding: 1cm;
            margin: 1cm auto;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            display: flex;
            flex-direction: column;
        }
        .content-body {
            flex-grow: 1;
        }
        .form-input-line {
            font-family: inherit;
            font-size: inherit;
            border: none;
            border-bottom: 1px dotted #000;
            background-color: transparent;
            padding: 1px;
            outline: none;
            text-align: center;
        }
        .print-footer {
            padding: 8px 12px;
            font-size: 11px;
            margin-top: 20px;
        }
        .print-footer .form-input-line {
            border-bottom: 1px solid #000;
            min-width: 20px;
            font-weight: bold;
        }
        .print-footer .form-input-line:focus {
            background-color: #f0f9ff;
            border-bottom: 2px solid #3b82f6;
        }
        h1, h2, .font-bold {
            font-weight: 700;
        }
        .title-main { font-size: 18px; }
        .title-sub { font-size: 16px; }

        .data-table {
            border: 1px solid #000;
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }
        .data-table th, .data-table td {
            border: 1px solid #000;
            border-collapse: collapse;
            padding: 4px;
            text-align: center;
            vertical-align: middle;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .data-table tbody tr {
             min-height: 35px;
             height: auto !important;
        }
        .data-table tbody tr:has(td:last-child textarea[value*=" "]) {
             height: auto !important;
             min-height: 50px !important;
        }
        .data-table td:last-child {
            width: 150px !important;
            min-width: 150px;
            max-width: 200px;
            padding: 8px !important;
            vertical-align: top !important;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
        }
        .data-table input[type="text"] {
            width: 100%;
            min-height: 30px;
            height: auto !important;
            border: none;
            outline: none;
            background-color: transparent;
            text-align: left !important;
            word-wrap: break-word;
            white-space: normal !important;
            overflow-wrap: break-word;
            line-height: 1.3;
            padding: 2px 4px;
            resize: none;
            overflow: visible;
        }
        .data-table td:last-child input[type="text"] {
            text-align: left !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            min-height: 40px;
            height: auto !important;
            line-height: 1.4;
            padding: 4px;
        }
        .data-table td:last-child textarea {
            width: 100% !important;
            min-height: 40px !important;
            height: auto !important;
            border: none !important;
            outline: none !important;
            background: transparent !important;
            resize: none !important;
            word-wrap: break-word !important;
            white-space: pre-wrap !important;
            overflow-wrap: anywhere !important;
            word-break: break-all !important;
            line-height: 1.2 !important;
            padding: 4px !important;
            font-family: inherit !important;
            font-size: 10px !important;
            text-align: left !important;
            overflow: visible !important;
            max-height: none !important;
        }

        .signature-area {
            text-align: center;
        }
        .signature-space {
            height: 60px;
        }

        .page-numbering-notice {
            border-radius: 4px;
            font-size: 13px;
        }

        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4);
            }
            50% {
                transform: scale(1.02);
                box-shadow: 0 0 0 8px rgba(251, 191, 36, 0);
            }
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background-color: #fff !important;
            }
            .page-numbering-notice {
                display: none !important;
            }
            .a4-landscape-page {
                width: 100%;
                height: 100%;
                margin: 0 !important;
                padding: 1cm !important;
                box-shadow: none !important;
                border: none !important;
            }
             body > *:not(.a4-landscape-page) {
                display: none;
            }
            .data-table thead {
                display: table-header-group;
            }
            .data-table tr, .signature-area {
                page-break-inside: avoid;
            }
            .data-table td:last-child {
                width: 15% !important;
                min-width: 150px !important;
                max-width: none !important;
            }
            .data-table td:last-child input[type="text"],
            .data-table td:last-child textarea {
                white-space: pre-wrap !important;
                word-break: break-word !important;
                overflow-wrap: anywhere !important;
                height: auto !important;
                min-height: 40px !important;
                line-height: 1.3 !important;
                overflow: visible !important;
            }
            .data-table td:last-child textarea {
                resize: none !important;
                border: none !important;
                background: transparent !important;
                font-family: inherit !important;
                font-size: 10px !important;
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
            }
            .data-table tbody tr {
                height: auto !important;
                min-height: 40px !important;
                page-break-inside: avoid;
            }
            .print-footer {
                position: fixed;
                bottom: 0.5cm;
                left: 0;
                right: 0;
                width: 100%;
                background-color: #f8f9fa !important;
                color: #6c757d !important;
                border-top: 1px solid #dee2e6 !important;
                padding: 8px 1cm !important;
                font-size: 10px !important;
                z-index: 1000;
            }
            .print-footer .form-input-line {
                color: #6c757d !important;
                border-bottom-color: #6c757d !important;
            }
             .content-body {
                padding-bottom: 50px;
            }
        }
    </style>
    <script>
        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const minHeight = 40;
            const maxHeight = 120;
            const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));
            textarea.style.height = newHeight + 'px';

            const textLength = textarea.value.length;
            if (textLength > 100) {
                textarea.style.fontSize = '9px';
            } else if (textLength > 50) {
                textarea.style.fontSize = '10px';
            } else {
                textarea.style.fontSize = '11px';
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            const textareas = document.querySelectorAll('.auto-resize-textarea');
            textareas.forEach(function(textarea) {
                autoResizeTextarea(textarea);

                textarea.addEventListener('input', function() {
                    autoResizeTextarea(this);
                });

                textarea.addEventListener('paste', function() {
                    setTimeout(() => autoResizeTextarea(this), 10);
                });
            });

            const pageInputs = document.querySelectorAll('.print-footer .form-input-line');
            pageInputs.forEach(function(input) {
                input.addEventListener('focus', function() {
                    this.select();
                    this.style.backgroundColor = '#ffffff';
                    this.style.color = '#000';
                });

                input.addEventListener('blur', function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.color = '#6c757d';
                });

                input.addEventListener('input', function() {
                    this.value = this.value.replace(/[^0-9]/g, '');
                    if (this.value === '') this.value = '1';
                });
            });

            const notice = document.querySelector('.page-numbering-notice');
            if (notice) {
                setTimeout(() => {
                    notice.style.animation = 'pulse 2s ease-in-out 3';
                }, 500);
            }
        });
    </script>
</head>
<body>

    <div class="a4-landscape-page">
        <div class="content-body">
            <!-- Header -->
            <header>
                 <div class="flex justify-between items-start">
                    <div class="text-center w-1/4">
                        <img src="${logoUrl}" alt="Logo" class="w-16" onerror="this.onerror=null;this.src='https://placehold.co/100x100/e2e8f0/e2e8f0?text=Logo';">
                    </div>
                    <div class="text-center w-1/2">
                         <h2 class="title-sub uppercase font-bold">${organizationName}</h2>
                         <div class="flex items-baseline justify-center font-bold text-base">
                            <label for="department-name">KHOA/PHÒNG:</label>
                            <input type="text" id="department-name" class="form-input-line flex-grow ml-2" value="${formatValue(selectedPlan.khoa_phong)}">
                         </div>
                    </div>
                    <div class="w-1/4"></div>
                </div>
                 <div class="text-center mt-4">
                     <h1 class="title-main uppercase font-bold flex justify-center items-baseline">
                        KẾ HOẠCH ${selectedPlan.loai_cong_viec.toUpperCase()} THIẾT BỊ NĂM
                        <input type="text" class="form-input-line w-24 ml-2" value="${selectedPlan.nam}">
                    </h1>
                </div>
            </header>

            <!-- Main Table -->
            <section class="mt-4">
                <table class="w-full data-table">
                    <thead class="font-bold">
                        <tr>
                            <th rowspan="2" class="w-[3%]">TT</th>
                            <th rowspan="2" class="w-[7%]">Mã TB</th>
                            <th rowspan="2" class="w-[12%]">Tên TB</th>
                            <th rowspan="2" class="w-[10%]">Khoa/Phòng</th>
                            <th colspan="2">Đơn vị thực hiện</th>
                            <th colspan="12">Thời gian dự kiến ${selectedPlan.loai_cong_viec.toLowerCase()} (tháng)</th>
                            <th rowspan="2" class="w-[16%]">Điểm BT/HC/KĐ</th>
                        </tr>
                        <tr>
                            <th class="w-[7%]">Nội bộ</th>
                            <th class="w-[7%]">Thuê ngoài</th>
                            <th class="w-[0.75%]">1</th>
                            <th class="w-[0.75%]">2</th>
                            <th class="w-[0.75%]">3</th>
                            <th class="w-[0.75%]">4</th>
                            <th class="w-[0.75%]">5</th>
                            <th class="w-[0.75%]">6</th>
                            <th class="w-[0.75%]">7</th>
                            <th class="w-[0.75%]">8</th>
                            <th class="w-[0.75%]">9</th>
                            <th class="w-[0.75%]">10</th>
                            <th class="w-[0.75%]">11</th>
                            <th class="w-[0.75%]">12</th>
                        </tr>
                    </thead>
                    <tbody id="plan-table-body">
                        ${generateTableRows()}
                    </tbody>
                </table>
            </section>

             <!-- Signature section -->
            <section class="mt-4">
                 <div class="flex justify-between">
                    <div class="signature-area w-1/3">
                        <p class="font-bold">Lãnh đạo Khoa/Phòng</p>
                        <div class="signature-space"></div>
                    </div>
                     <div class="w-1/3"></div>
                    <div class="signature-area w-1/3">
                         <p class="italic mb-2">
                            Cần Thơ, ngày <input type="text" class="form-input-line w-12" value="${new Date().getDate()}">
                            tháng <input type="text" class="form-input-line w-12" value="${new Date().getMonth() + 1}">
                            năm <input type="text" class="form-input-line w-20" value="${new Date().getFullYear()}">
                        </p>
                         <p class="font-bold">Người lập</p>
                         <div class="signature-space"></div>
                         <input type="text" class="form-input-line" value="${formatValue(user?.full_name)}" style="border-bottom: none; text-align: center; font-weight: bold;">
                     </div>
                </div>
            </section>
        </div>

    </div>

</body>
</html>
  `
}
