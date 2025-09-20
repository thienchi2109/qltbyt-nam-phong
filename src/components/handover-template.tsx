"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

interface HandoverDevice {
  code?: string
  name?: string
  model?: string
  serial?: string
  accessories?: string
  condition?: string
  note?: string
}

interface HandoverTemplateProps {
  department?: string
  handoverDate?: Date | string
  reason?: string
  requestCode?: string
  giverName?: string
  directorName?: string
  receiverName?: string
  devices?: HandoverDevice[]
  autoPrint?: boolean
}

export function HandoverTemplate({
  department = "Tổ QLTB",
  handoverDate = new Date(),
  reason = "",
  requestCode = "",
  giverName = "",
  directorName = "",
  receiverName = "",
  devices = [],
  autoPrint = false
}: HandoverTemplateProps) {
  React.useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 500)
      return () => clearTimeout(timer)
    }
  }, [autoPrint])

  const formatDate = (dateValue: Date | string) => {
    if (!dateValue) return ''
    try {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return String(dateValue)
    }
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    return String(value).trim()
  }

  // Use devices or create empty rows for manual entry
  const displayDevices = devices.length > 0 ? devices : [{}]

  return (
    <div className="bg-gray-200 min-h-screen">
      <div className="a4-landscape-page">
        <div className="content-body">
          {/* Header with tenant branding */}
          <header className="text-center mb-4">
            <div className="flex justify-between items-start">
              <div className="w-14"></div>
              <div className="flex-grow">
                <FormBrandingHeader 
                  align="center" 
                  size="md" 
                  showDivider={false}
                  className="mb-4"
                />
                <h1 className="title-main uppercase font-bold">
                  BIÊN BẢN BÀN GIAO THIẾT BỊ
                </h1>
              </div>
              <div className="w-14"></div>
            </div>
          </header>

          {/* Info Section */}
          <section className="mt-4 space-y-2">
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Khoa/Phòng lập:</label>
              <div className="form-input-line form-input-readonly ml-2">
                {formatValue(department)}
              </div>
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Ngày nhận/giao:</label>
              <div className="form-input-line form-input-readonly ml-2">
                {formatDate(handoverDate)}
              </div>
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Lý do nhận bàn giao:</label>
              <div className="form-input-line form-input-readonly ml-2">
                {formatValue(reason)}
              </div>
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap">Mã yêu cầu:</label>
              <div className="form-input-line form-input-readonly ml-2">
                {formatValue(requestCode)}
              </div>
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
              <tbody>
                {displayDevices.map((device, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{formatValue(device.code)}</td>
                    <td className="text-left">{formatValue(device.name)}</td>
                    <td>{formatValue(device.model)}</td>
                    <td>{formatValue(device.serial)}</td>
                    <td 
                      className="editable-cell text-left" 
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Nhập tài liệu/phụ kiện kèm theo..."
                    >
                      {formatValue(device.accessories)}
                    </td>
                    <td 
                      className="editable-cell" 
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Nhập tình trạng thiết bị..."
                    >
                      {formatValue(device.condition)}
                    </td>
                    <td 
                      className="editable-cell" 
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Nhập ghi chú..."
                    >
                      {formatValue(device.note)}
                    </td>
                  </tr>
                ))}
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
                <div className="font-bold">{formatValue(giverName)}</div>
              </div>
              <div className="signature-area">
                <p className="font-bold">Ban Giám đốc</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
                <div className="signature-space"></div>
                <div className="font-bold">{formatValue(directorName)}</div>
              </div>
              <div className="signature-area">
                <p className="font-bold">Đại diện bên nhận</p>
                <p className="italic">(Ký, ghi rõ họ tên)</p>
                <div className="signature-space"></div>
                <div className="font-bold">{formatValue(receiverName)}</div>
              </div>
            </div>
          </section>
        </div>
      </div>

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
          font-family: 'Times New Roman', Times, serif;
          font-size: 13px;
          color: #000;
          line-height: 1.4;
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

        .title-main { font-size: 18px; }
        .title-sub { font-size: 14px; }
        .space-y-2 > * + * { margin-top: 0.3rem; }

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

        .signature-area {
          text-align: center;
          min-width: 180px;
        }

        .signature-space {
          height: 50px;
          border-bottom: 1px solid #ddd;
          margin: 8px 0;
        }

        .edit-instruction {
          font-size: 10px;
          color: #666;
          font-style: italic;
          margin-top: 6px;
          text-align: center;
        }

        @media print {
          .a4-landscape-page {
            width: 100%;
            height: 100%;
            margin: 0 !important;
            padding: 1cm !important;
            box-shadow: none !important;
            border: none !important;
          }

          .data-table thead {
            display: table-header-group;
          }

          .data-table tr, .signature-area {
            page-break-inside: avoid;
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