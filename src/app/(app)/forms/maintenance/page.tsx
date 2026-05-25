"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

/** Renders the printable maintenance planning form template. */
export default function MaintenanceFormPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="a4-landscape-page">
        {/* Branding Header */}
        <div className="mb-6">
          <FormBrandingHeader align="center" size="lg" />
        </div>
        
        {/* Maintenance Form Content */}
        <div className="content-body">
          {/* Header */}
          <header>
            <div className="flex justify-between items-start">
              <div className="text-center w-1/4">
                {/* Logo will be handled by FormBrandingHeader */}
              </div>
              <div className="text-center w-1/2">
                <h2 className="title-sub uppercase font-semibold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                <div className="flex items-baseline justify-center font-bold">
                  <label htmlFor="department-name">KHOA/PHÒNG:</label>
                  <input
                    type="text"
                    id="department-name"
                    className="form-input-line flex-grow ml-2"
                    aria-label="Khoa phòng lập kế hoạch"
                  />
                </div>
              </div>
              <div className="w-1/4"></div> {/* Spacer */}
            </div>
            <div className="text-center mt-4">
              <h1 className="title-main uppercase font-semibold flex justify-center items-baseline">
                KẾ HOẠCH BẢO TRÌ HIỆU CHUẨN/KIỂM ĐỊNH THIẾT BỊ NĂM
                <input type="text" className="form-input-line w-24 ml-2" aria-label="Năm kế hoạch bảo trì" />
              </h1>
            </div>
          </header>

          {/* Main Table */}
          <section className="mt-4">
            <table className="w-full data-table">
              <thead className="font-bold">
                <tr>
                  <th rowSpan={2} className="w-[3%]">TT</th>
                  <th rowSpan={2} className="w-[8%]">Mã TB</th>
                  <th rowSpan={2} className="w-[15%]">Tên TB</th>
                  <th rowSpan={2} className="w-[12%]">Khoa/Phòng sử dụng</th>
                  <th colSpan={2}>Đơn vị thực hiện</th>
                  <th colSpan={12}>Thời gian dự kiến hiệu chuẩn/kiểm định (tháng)</th>
                  <th rowSpan={2} className="w-[8%]">Điểm hiệu chuẩn/kiểm định</th>
                </tr>
                <tr>
                  <th className="w-[5%]">Nội bộ</th>
                  <th className="w-[5%]">Thuê ngoài</th>
                  <th className="w-[2.5%]">1</th>
                  <th className="w-[2.5%]">2</th>
                  <th className="w-[2.5%]">3</th>
                  <th className="w-[2.5%]">4</th>
                  <th className="w-[2.5%]">5</th>
                  <th className="w-[2.5%]">6</th>
                  <th className="w-[2.5%]">7</th>
                  <th className="w-[2.5%]">8</th>
                  <th className="w-[2.5%]">9</th>
                  <th className="w-[2.5%]">10</th>
                  <th className="w-[2.5%]">11</th>
                  <th className="w-[2.5%]">12</th>
                </tr>
              </thead>
              <tbody id="plan-table-body">
                {/* Example empty row */}
                <tr>
                  <td aria-label="Số thứ tự dòng kế hoạch mẫu"></td>
                  <td aria-label="Mã thiết bị dòng kế hoạch mẫu"></td>
                  <td aria-label="Tên thiết bị dòng kế hoạch mẫu"></td>
                  <td aria-label="Khoa phòng sử dụng dòng kế hoạch mẫu"></td>
                  <td><input type="checkbox" aria-label="Thực hiện nội bộ cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Thuê ngoài cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 1 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 2 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 3 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 4 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 5 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 6 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 7 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 8 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 9 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 10 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 11 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="checkbox" aria-label="Tháng 12 cho dòng kế hoạch mẫu" /></td>
                  <td><input type="text" aria-label="Điểm hiệu chuẩn kiểm định cho dòng kế hoạch mẫu" /></td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  )
}
