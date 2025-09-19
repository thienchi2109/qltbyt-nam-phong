"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

interface UsageLogEntry {
  dateTime?: string
  user?: string
  condition?: string
  note?: string
}

interface LogTemplateProps {
  department?: string
  deviceManager?: string
  deviceName?: string
  deviceCode?: string
  model?: string
  serial?: string
  usageLogs?: UsageLogEntry[]
}

export function LogTemplate({
  department = "",
  deviceManager = "",
  deviceName = "",
  deviceCode = "",
  model = "",
  serial = "",
  usageLogs = []
}: LogTemplateProps) {
  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    return String(value).trim()
  }

  // Create at least 10 rows for the table
  const displayLogs = [...usageLogs]
  while (displayLogs.length < 10) {
    displayLogs.push({})
  }

  return (
    <div className="bg-gray-200 min-h-screen">
      <div className="a4-page">
        <div className="content-body">
          {/* Header */}
          <header className="text-center">
            <div className="flex justify-between items-center">
              <div className="w-20"></div>
              <div className="flex-grow">
                <FormBrandingHeader 
                  align="center" 
                  size="md" 
                  showDivider={false}
                  className="mb-2"
                />
                <div className="flex items-baseline justify-center mt-1">
                  <label className="font-bold whitespace-nowrap">KHOA/PHÒNG:</label>
                  <div className="w-1/2 ml-2">
                    <input 
                      type="text" 
                      className="form-input-line"
                      defaultValue={formatValue(department)}
                    />
                  </div>
                </div>
              </div>
              <div className="w-20"></div>
            </div>
            <h1 className="title-main uppercase font-bold text-center my-4">
              NHẬT KÝ SỬ DỤNG THIẾT BỊ
            </h1>
          </header>

          {/* Info Section */}
          <section className="space-y-2 mb-4">
            <div className="flex items-baseline">
              <label className="whitespace-nowrap w-40">Người quản lý thiết bị:</label>
              <input 
                type="text" 
                className="form-input-line ml-2"
                defaultValue={formatValue(deviceManager)}
              />
            </div>
            <div className="flex items-baseline">
              <label className="whitespace-nowrap w-40">Tên thiết bị:</label>
              <input 
                type="text" 
                className="form-input-line ml-2"
                defaultValue={formatValue(deviceName)}
              />
            </div>
            <div className="grid grid-cols-3 gap-x-8">
              <div className="flex items-baseline">
                <label className="whitespace-nowrap">Mã thiết bị:</label>
                <input 
                  type="text" 
                  className="form-input-line ml-2"
                  defaultValue={formatValue(deviceCode)}
                />
              </div>
              <div className="flex items-baseline">
                <label className="whitespace-nowrap">Model:</label>
                <input 
                  type="text" 
                  className="form-input-line ml-2"
                  defaultValue={formatValue(model)}
                />
              </div>
              <div className="flex items-baseline">
                <label className="whitespace-nowrap">Serial N⁰:</label>
                <input 
                  type="text" 
                  className="form-input-line ml-2"
                  defaultValue={formatValue(serial)}
                />
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
              <tbody>
                {displayLogs.map((log, index) => (
                  <tr key={index}>
                    <td>{formatValue(log.dateTime) || (index === 0 ? '\u00A0' : '')}</td>
                    <td>{formatValue(log.user)}</td>
                    <td>{formatValue(log.condition)}</td>
                    <td>{formatValue(log.note)}</td>
                  </tr>
                ))}
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
          font-family: 'Times New Roman', Times, serif;
          font-size: 14px;
          color: #000;
          line-height: 1.5;
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

        .title-main { font-size: 20px; }
        .title-sub { font-size: 16px; }
        .space-y-2 > * + * { margin-top: 0.5rem; }

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

          .data-table thead {
            display: table-header-group;
          }

          .data-table tr {
            page-break-inside: avoid;
          }

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