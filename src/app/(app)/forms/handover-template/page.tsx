"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

export default function HandoverTemplateFormPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="a4-landscape-page">
        {/* Branding Header */}
        <div className="mb-6">
          <FormBrandingHeader align="center" size="lg" />
        </div>
        
        {/* Handover Form Content */}
        <div className="content-body">
          {/* Header */}
          <header className="text-center">
            <div className="flex justify-between items-start">
              <div className="text-center">
                {/* Logo handled by FormBrandingHeader */}
              </div>
              <div className="flex-grow">
                <h2 className="title-sub uppercase font-bold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                <h1 className="title-main uppercase mt-3 font-bold">BIÊN BẢN BÀN GIAO THIẾT BỊ</h1>
              </div>
              <div className="w-14"></div>
            </div>
          </header>

          {/* Info Section */}
          <section className="mt-4 space-y-2">
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Khoa/Phòng lập:</label>
              <div id="department" className="form-input-line form-input-readonly ml-2"></div>
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Ngày nhận/giao:</label>
              <div id="handover-date" className="form-input-line form-input-readonly ml-2"></div>
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Lý do nhận bàn giao:</label>
              <div id="reason" className="form-input-line form-input-readonly ml-2"></div>
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Mã yêu cầu:</label>
              <div id="request-code" className="form-input-line form-input-readonly ml-2"></div>
            </div>
          </section>

          {/* Main Table */}
          <section className="mt-4">
            <table className="w-full data-table">
              <thead className="font-bold">
                <tr>
                  <th className="w-[2%]">STT</th>
                  <th className="w-[7%]">Mã thiết bị</th>
                  <th className="w-[18%]">Tên thiết bị</th>
                  <th className="w-[7%]">Model</th>
                  <th className="w-[7%]">Serial</th>
                  <th className="w-[20%]">Tài liệu/phụ kiện kèm theo (nếu có)</th>
                  <th className="w-[18%]">Tình trạng khi nhận/giao</th>
                  <th className="w-[21%]">Ghi chú</th>
                </tr>
              </thead>
              <tbody id="device-table-body">
                {/* Dynamic content will be inserted here */}
              </tbody>
            </table>
            <div className="edit-instruction">
              * Các ô có nền xám có thể nhập liệu trực tiếp bằng cách nhấp chuột vào
            </div>
          </section>

          {/* Signature section */}
          <section className="mt-8">
            <div className="flex justify-around">
              <div className="signature-area">
                <p className="font-bold">Đại diện bên giao</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
                <div className="signature-space"></div>
                <div id="giver-name" className="font-bold"></div>
              </div>
              <div className="signature-area">
                <p className="font-bold">Ban Giám đốc</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
                <div className="signature-space"></div>
                <div id="director-name" className="font-bold"></div>
              </div>
              <div className="signature-area">
                <p className="font-bold">Đại diện bên nhận</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
                <div className="signature-space"></div>
                <div id="receiver-name" className="font-bold"></div>
              </div>
            </div>
          </section>
        </div>
        
        {/* Footer */}
        <footer className="print-footer flex justify-between items-center text-xs">
          <span>QLTB-BM.14</span>
          <span>BH.01 (05/2024)</span>
          <span>Trang: <span id="page-number">1</span>/<span id="total-pages">1</span></span>
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
          padding: 2px 1px;
          outline: none;
          width: 100%;
          min-height: 1.1em;
        }
        
        .form-input-readonly {
          border-bottom: 1px solid #000;
          font-weight: 500;
        }
        
        .editable-cell {
          border-bottom: 1px solid #ccc !important;
          background-color: #f9f9f9;
          cursor: text;
          min-height: 18px;
          padding: 3px 4px !important;
        }
        
        .editable-cell:focus {
          background-color: #fff;
          border-bottom: 1px solid #007bff !important;
          outline: none;
        }
        
        .editable-cell:empty:before {
          content: attr(data-placeholder);
          color: #999;
          font-style: italic;
        }
        
        .font-bold { font-weight: 700; }
        .title-main { font-size: 18px; }
        .title-sub { font-size: 14px; }
        .text-center { text-align: center; }
        .uppercase { text-transform: uppercase; }
        .italic { font-style: italic; }
        .whitespace-nowrap { white-space: nowrap; }
        
        /* Flexbox utilities */
        .flex { display: flex; }
        .items-center { align-items: center; }
        .items-baseline { align-items: baseline; }
        .items-start { align-items: flex-start; }
        .justify-between { justify-content: space-between; }
        .justify-around { justify-content: space-around; }
        .flex-grow { flex-grow: 1; }
        
        /* Spacing utilities - optimized for compact layout */
        .mt-3 { margin-top: 0.4rem; }
        .mt-4 { margin-top: 0.5rem; }
        .mt-8 { margin-top: 1rem; }
        .ml-2 { margin-left: 0.5rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.3rem; }
        
        /* Width utilities */
        .w-14 { width: 3.5rem; }
        .w-full { width: 100%; }
        
        /* Table styles */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .data-table th, .data-table td {
          border: 1px solid #000;
          padding: 3px;
          text-align: center;
          vertical-align: middle;
        }

        .data-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }

        /* Text alignment for specific columns */
        .data-table td:nth-child(3),
        .data-table td:nth-child(6) {
          text-align: left;
        }
        
        /* Signature styles */
        .signature-area {
          text-align: center;
          min-width: 180px;
        }
        
        .signature-space {
          height: 50px;
          border-bottom: 1px solid #ddd;
          margin: 8px 0;
        }
        
        /* Edit instruction */
        .edit-instruction {
          font-size: 10px;
          color: #666;
          font-style: italic;
          margin-top: 6px;
          text-align: center;
        }
        
        /* Print optimizations */
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

          .edit-instruction {
            display: none !important;
          }

          .editable-cell {
            background-color: transparent !important;
            border-bottom: 1px solid #000 !important;
          }
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
          .a4-landscape-page {
            width: 100%;
            margin: 0;
            padding: 0.4cm;
            box-shadow: none;
          }
          
          .title-main { font-size: 16px; }
          .title-sub { font-size: 12px; }
          .data-table { font-size: 10px; }
          .data-table th, .data-table td { padding: 3px 2px; }
        }
      `}</style>
    </div>
  )
}