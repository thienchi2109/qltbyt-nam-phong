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
      </div>
    </div>
  )
}