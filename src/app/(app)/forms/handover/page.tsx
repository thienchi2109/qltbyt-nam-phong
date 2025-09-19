"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

export default function HandoverFormPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="a4-landscape-page">
        {/* Branding Header */}
        <div className="mb-6">
          <FormBrandingHeader align="center" size="lg" />
        </div>
        
        {/* Handover Form Content */}
        <div className="content-body">
          <div className="text-center mb-6">
            <h1 className="title-main font-bold uppercase">Biên Bản Bàn Giao Thiết Bị</h1>
            <p className="mt-2">Số: <span className="form-input-line" id="request-code"></span></p>
          </div>
          
          <div className="mb-6">
            <p><span className="font-bold">Khoa/Phòng lập:</span> <span className="form-input-line" id="department"></span></p>
            <p className="mt-3"><span className="font-bold">Ngày bàn giao:</span> <span className="form-input-line" id="handover-date"></span></p>
            <p className="mt-3"><span className="font-bold">Lý do bàn giao:</span> <span className="form-input-line" id="reason"></span></p>
          </div>
          
          <div className="mb-6">
            <table className="data-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã TB</th>
                  <th>Tên thiết bị</th>
                  <th>Model</th>
                  <th>S/N</th>
                  <th>Tài liệu, phụ kiện kèm theo</th>
                  <th>Tình trạng thiết bị</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody id="device-table-body">
                <tr>
                  <td>1</td>
                  <td><span className="form-input-line"></span></td>
                  <td><span className="form-input-line"></span></td>
                  <td><span className="form-input-line"></span></td>
                  <td><span className="form-input-line"></span></td>
                  <td className="editable-cell" contentEditable data-placeholder="Nhập tài liệu/phụ kiện kèm theo..."></td>
                  <td className="editable-cell" contentEditable data-placeholder="Nhập tình trạng thiết bị..."></td>
                  <td className="editable-cell" contentEditable data-placeholder="Nhập ghi chú..."></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-between mt-8">
            <div className="signature-area">
              <p className="font-bold">ĐẠI DIỆN BÊN GIAO</p>
              <p className="italic">(Ký, ghi rõ họ tên)</p>
              <div className="signature-space"></div>
              <p className="form-input-line" id="giver-name"></p>
            </div>
            
            <div className="signature-area">
              <p className="font-bold">ĐẠI DIỆN BÊN NHẬN</p>
              <p className="italic">(Ký, ghi rõ họ tên)</p>
              <div className="signature-space"></div>
              <p className="form-input-line" id="receiver-name"></p>
            </div>
          </div>
          
          <div className="text-center mt-8 text-sm">
            <p className="italic">Ghi chú: Biên bản được lập thành 02 bản, bên giao và bên nhận mỗi bên 01 bản.</p>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="print-footer flex justify-between items-center text-xs mt-4 pt-2 border-t border-gray-300">
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
        .text-center { text-align: center; }
        .uppercase { text-transform: uppercase; }
        .italic { font-style: italic; }
        
        /* Spacing utilities */
        .mt-2 { margin-top: 0.5rem; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-8 { margin-top: 2rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        
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

          .editable-cell {
            background-color: transparent !important;
            border-bottom: 1px solid #000 !important;
          }
        }
      `}</style>
    </div>
  )
}