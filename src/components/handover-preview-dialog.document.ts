import { HANDOVER_PRINT_STYLES } from "./handover-preview-dialog.print-styles"
import type { HandoverData } from "./handover-preview-dialog.types"

export function generateHandoverHTML(data: HandoverData): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Biên Bản Bàn Giao Thiết Bị</title>
    <style>${HANDOVER_PRINT_STYLES}</style>
</head>
<body>
    <div class="a4-landscape-page">
        <div class="content-body">
            <header class="text-center">
                <div class="flex justify-between items-start">
                    <div class="text-center">
                        <img src="https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png"
                             alt="Logo CDC"
                             class="w-14 mx-auto mb-1"
                             onerror="this.style.display='none';">
                    </div>
                    <div class="flex-grow">
                        <h2 class="title-sub uppercase font-bold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                        <h1 class="title-main uppercase mt-3 font-bold">BIÊN BẢN BÀN GIAO THIẾT BỊ</h1>
                    </div>
                    <div class="w-14"></div>
                </div>
            </header>

            <section class="mt-4 space-y-2">
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Khoa/Phòng lập:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.department}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Ngày nhận/giao:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.handoverDate}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Lý do nhận bàn giao:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.reason}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Mã yêu cầu:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.requestCode}</div>
                </div>
            </section>

            <section class="mt-3">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-stt">STT</th>
                            <th class="col-code">Mã thiết bị</th>
                            <th class="col-name">Tên thiết bị</th>
                            <th class="col-model">Model</th>
                            <th class="col-serial">Serial</th>
                            <th class="col-accessories">Tài liệu/phụ kiện kèm theo (nếu có)</th>
                            <th class="col-condition">Tình trạng khi nhận/giao</th>
                            <th class="col-note">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="col-stt">1</td>
                            <td class="col-code">${data.device.code}</td>
                            <td class="col-name">${data.device.name}</td>
                            <td class="col-model">${data.device.model}</td>
                            <td class="col-serial">${data.device.serial}</td>
                            <td class="col-accessories">${data.device.accessories}</td>
                            <td class="col-condition">${data.device.condition}</td>
                            <td class="col-note">${data.device.note}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section class="mt-8">
                <div class="flex justify-around">
                    <div class="signature-area">
                        <p class="font-bold">Đại diện bên giao</p>
                        <p class="italic">(Ký, ghi rõ họ tên)</p>
                        <div class="signature-space"></div>
                        <div class="font-bold">${data.giverName}</div>
                    </div>
                    <div class="signature-area">
                        <p class="font-bold">Ban Giám đốc</p>
                        <p class="italic">(Ký, ghi rõ họ tên)</p>
                        <div class="signature-space"></div>
                        <div class="font-bold">${data.directorName}</div>
                    </div>
                    <div class="signature-area">
                        <p class="font-bold">Đại diện bên nhận</p>
                        <p class="italic">(Ký, ghi rõ họ tên)</p>
                        <div class="signature-space"></div>
                        <div class="font-bold">${data.receiverName}</div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</body>
</html>`
}
