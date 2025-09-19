"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

export default function MaintenanceFormTemplatePage() {
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
                {/* Logo handled by FormBrandingHeader */}
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

          {/* Signature section */}
          <section className="mt-4">
            <div className="flex justify-between">
              <div className="signature-area w-1/3">
                <p className="font-bold">Lãnh đạo Khoa/Phòng</p>
                <div className="signature-space"></div>
              </div>
              <div className="w-1/3"></div> {/* Spacer */}
              <div className="signature-area w-1/3">
                <p className="italic mb-2">
                  Cần Thơ, ngày <input type="text" className="form-input-line w-12" />
                  tháng <input type="text" className="form-input-line w-12" />
                  năm <input type="text" className="form-input-line w-20" />
                </p>
                <p className="font-bold">Người lập</p>
                <div className="signature-space"></div>
              </div>
            </div>
          </section>
        </div>
        
        {/* Footer */}
        <footer className="print-footer flex justify-between items-center text-xs">
          <span>QLTB-BM.09</span>
          <span>BH.01 (05/2024)</span>
          <span>Trang: 1/1</span>
        </footer>
      </div>
      
      {/* Inline styles */}
      <style jsx>{`
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
        
        h1, h2, .font-bold {
          font-weight: 700;
        }
        
        .title-main { font-size: 18px; }
        .title-sub { font-size: 16px; }

        /* Table styles */
        .data-table, .data-table th, .data-table td {
          border: 1px solid #000;
          border-collapse: collapse;
        }
        
        .data-table th, .data-table td {
          padding: 4px;
          text-align: center;
          vertical-align: middle;
        }
        
        .data-table tbody tr {
          height: 35px;
        }
        
        .data-table input[type="text"] {
          width: 100%;
          height: 100%;
          border: none;
          outline: none;
          background-color: transparent;
          text-align: center;
        }

        /* Signature styles */
        .signature-area {
          text-align: center;
        }
        
        .signature-space {
          height: 60px;
        }

        /* CSS for printing */
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #fff !important;
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
          
          /* Repeat table headers on each page */
          .data-table thead {
            display: table-header-group;
          }
          
          /* Prevent items from breaking across pages */
          .data-table tr, .signature-area {
            page-break-inside: avoid;
          }
          
          /* Fixed footer at bottom of each printed page */
          .print-footer {
            position: fixed;
            bottom: 1cm;
            left: 1cm;
            right: 1cm;
            width: calc(100% - 2cm);
          }
          
          .content-body {
            padding-bottom: 30px;
          }
        }
      `}</style>
    </div>
  )
}