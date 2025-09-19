"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

export default function LogTemplateFormPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="a4-page">
        {/* Branding Header */}
        <div className="mb-6">
          <FormBrandingHeader align="center" size="lg" />
        </div>
        
        {/* Log Form Content */}
        <div className="content-body">
          {/* Header */}
          <header className="text-center">
            <div className="flex justify-between items-center">
              <div className="flex-grow">
                <h2 className="title-sub uppercase font-bold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                <div className="flex items-baseline justify-center mt-1">
                  <label className="font-bold whitespace-nowrap">KHOA/PHÒNG:</label>
                  <div className="w-1/2 ml-2"><input type="text" className="form-input-line" /></div>
                </div>
              </div>
            </div>
            <h1 className="title-main uppercase font-bold text-center my-4">NHẬT KÝ SỬ DỤNG THIẾT BỊ</h1>
          </header>

          {/* Info Section */}
          <section className="space-y-2 mb-4">
            <div className="flex items-baseline">
              <label className="whitespace-nowrap w-40">Người quản lý thiết bị:</label>
              <input type="text" className="form-input-line ml-2" />
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap w-40">Tên thiết bị:</label>
              <input type="text" className="form-input-line ml-2" />
            </div>
            <div className="grid grid-cols-3 gap-x-8">
              <div className="flex items-baseline">
                <label className="whitespace-nowrap">Mã thiết bị:</label>
                <input type="text" className="form-input-line ml-2" />
              </div>
              <div className="flex items-baseline">
                <label className="whitespace-nowrap">Model:</label>
                <input type="text" className="form-input-line ml-2" />
              </div>
              <div className="flex items-baseline">
                <label className="whitespace-nowrap">Serial N⁰:</label>
                <input type="text" className="form-input-line ml-2" />
              </div>
            </div>
          </section>

          {/* Main Table */}
          <section>
            <table className="w-full data-table">
              <thead className="font-bold">
                <tr>
                  <th className="w-1/4">Ngày, giờ sử dụng</th>
                  <th className="w-1/4">Người sử dụng</th>
                  <th className="w-1/4">Tình trạng thiết bị</th>
                  <th className="w-1/4">Ghi chú</th>
                </tr>
              </thead>
              <tbody id="usage-log-body">
                {/* 10 empty rows for data entry */}
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
              </tbody>
            </table>
          </section>
        </div>
        
        {/* Footer */}
        <footer className="print-footer flex justify-between items-center text-xs">
          <span>QLTB-BM.06</span>
          <span>BH.01 (05/2024)</span>
          <span>Trang: 1/1</span>
        </footer>
      </div>
      
      {/* Inline styles */}
      <style jsx>{`
        .a4-page {
          width: 21cm;
          min-height: 29.7cm;
          padding: 1cm 2cm;
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
          width: 100%;
        }
        
        h1, h2, .font-bold {
          font-weight: 700;
        }
        
        .title-main { font-size: 20px; }
        .title-sub { font-size: 16px; }

        /* Table styles */
        .data-table, .data-table th, .data-table td {
          border: 1px solid #000;
          border-collapse: collapse;
        }
        
        .data-table th, .data-table td {
          padding: 6px;
          text-align: center;
          vertical-align: middle;
        }
        
        .data-table tbody tr {
          height: 38px;
        }

        /* CSS for printing */
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #fff !important;
          }
          
          .a4-page {
            width: 100%;
            height: 100%;
            margin: 0 !important;
            padding: 1cm 2cm !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          body > *:not(.a4-page) {
            display: none;
          }
          
          /* Repeat table headers on each page */
          .data-table thead {
            display: table-header-group;
          }
          
          /* Prevent items from breaking across pages */
          .data-table tr {
            page-break-inside: avoid;
          }
          
          /* Fixed footer at bottom of each printed page */
          .print-footer {
            position: fixed;
            bottom: 1cm;
            left: 2cm;
            right: 2cm;
            width: calc(100% - 4cm);
          }
          
          .content-body {
            padding-bottom: 30px;
          }
        }
      `}</style>
    </div>
  )
}