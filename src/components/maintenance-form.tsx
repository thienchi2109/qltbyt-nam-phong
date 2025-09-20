"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"

interface MaintenanceDevice {
  code?: string
  name?: string
  department?: string
  internalImplementation?: boolean
  outsourcedImplementation?: boolean
  months?: boolean[]
  calibrationPoint?: string
}

interface MaintenanceFormProps {
  department?: string
  year?: number
  devices?: MaintenanceDevice[]
}

export function MaintenanceForm({
  department = "",
  year = new Date().getFullYear(),
  devices = []
}: MaintenanceFormProps) {
  // Create empty rows if no devices provided
  const displayDevices = devices.length > 0 ? devices : [{}]

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    return String(value).trim()
  }

  return (
    <div className="bg-gray-200 min-h-screen">
      <div className="a4-landscape-page">
        <div className="content-body">
          {/* Header */}
          <header>
            <div className="flex justify-between items-start">
              <div className="w-1/4"></div>
              <div className="text-center w-1/2">
                <FormBrandingHeader 
                  align="center" 
                  size="md" 
                  showDivider={false}
                  className="mb-2"
                />
                <div className="flex items-baseline justify-center font-bold">
                  <label htmlFor="department-name">KHOA/PHÒNG:</label>
                  <input 
                    type="text" 
                    id="department-name" 
                    className="form-input-line flex-grow ml-2"
                    defaultValue={formatValue(department)}
                  />
                </div>
              </div>
              <div className="w-1/4"></div>
            </div>
            <div className="text-center mt-4">
              <h1 className="title-main uppercase font-bold flex justify-center items-baseline">
                KẾ HOẠCH BẢO TRÌ HIỆU CHUẨN/KIỂM ĐỊNH THIẾT BỊ NĂM
                <input 
                  type="text" 
                  className="form-input-line w-24 ml-2"
                  defaultValue={year.toString()}
                />
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
              <tbody>
                {displayDevices.map((device, index) => (
                  <tr key={index}>
                    <td>{index + 1 || ''}</td>
                    <td>{formatValue(device.code)}</td>
                    <td>{formatValue(device.name)}</td>
                    <td>{formatValue(device.department)}</td>
                    <td>
                      <input 
                        type="checkbox" 
                        defaultChecked={device.internalImplementation || false}
                      />
                    </td>
                    <td>
                      <input 
                        type="checkbox" 
                        defaultChecked={device.outsourcedImplementation || false}
                      />
                    </td>
                    {Array.from({ length: 12 }, (_, monthIndex) => (
                      <td key={monthIndex}>
                        <input 
                          type="checkbox"
                          defaultChecked={(device.months && device.months[monthIndex]) || false}
                        />
                      </td>
                    ))}
                    <td>
                      <input 
                        type="text"
                        defaultValue={formatValue(device.calibrationPoint)}
                      />
                    </td>
                  </tr>
                ))}
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
              <div className="w-1/3"></div>
              <div className="signature-area w-1/3">
                <p className="italic mb-2">
                  Cần Thơ, ngày <input type="text" className="form-input-line w-12" />
                  {' '}tháng <input type="text" className="form-input-line w-12" />
                  {' '}năm <input type="text" className="form-input-line w-20" />
                </p>
                <p className="font-bold">Người lập</p>
                <div className="signature-space"></div>
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
          font-size: 12px;
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
          padding: 1px;
          outline: none;
          text-align: center;
        }

        .title-main { font-size: 18px; }
        .title-sub { font-size: 16px; }

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

        .data-table input[type="checkbox"] {
          margin: 0;
        }

        .signature-area {
          text-align: center;
        }

        .signature-space {
          height: 60px;
        }

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

          .data-table thead {
            display: table-header-group;
          }

          .data-table tr, .signature-area {
            page-break-inside: avoid;
          }



          .content-body {
            padding-bottom: 30px;
          }
        }
      `}</style>
    </div>
  )
}