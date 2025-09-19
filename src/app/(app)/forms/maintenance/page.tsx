"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

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
                <h2 className="title-sub uppercase font-bold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                <div className="flex items-baseline justify-center font-bold">
                  <label htmlFor="department-name">KHOA/PHÒNG:</label>
                  <input type="text" id="department-name" className="form-input-line flex-grow ml-2" />
                </div>
              </div>
              <div className="w-1/4"></div> {/* Spacer */}
            </div>
            <div className="text-center mt-4">
              <h1 className="title-main uppercase font-bold flex justify-center items-baseline">
                KẾ HOẠCH BẢO TRÌ HIỆU CHUẨN/KIỂM ĐỊNH THIẾT BỊ NĂM
                <input type="text" className="form-input-line w-24 ml-2" />
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
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="checkbox" /></td>
                  <td><input type="text" /></td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        
        {/* Footer */}
        <footer className="print-footer flex justify-between items-center text-xs mt-4 pt-2 border-t border-gray-300">
          <span>QLTB-BM.15</span>
          <span>BH.01 (05/2024)</span>
          <span>Trang: <span id="page-number">1</span>/<span id="total-pages">1</span></span>
        </footer>
      </div>
    </div>
  )
}