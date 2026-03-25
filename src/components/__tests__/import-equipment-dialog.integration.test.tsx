import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readExcelFile, worksheetToJson } from '@/lib/excel-utils'
import { callRpc } from '@/lib/rpc-client'
import { ImportEquipmentDialog } from '../import-equipment-dialog'

const mockToast = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
}))

vi.mock('@/lib/excel-utils', () => ({
  readExcelFile: vi.fn(),
  worksheetToJson: vi.fn(),
}))

vi.mock('@/components/equipment/equipment-table-columns', () => ({
  equipmentStatusOptions: [
    'Hoạt động',
    'Chờ sửa chữa',
    'Chờ bảo trì',
    'Chờ hiệu chuẩn/kiểm định',
    'Ngưng sử dụng',
    'Chưa có nhu cầu sử dụng',
  ],
}))

vi.mock('@/components/equipment-decommission-form', () => ({
  DECOMMISSION_DATE_STATUS_ERROR_MESSAGE:
    'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"',
  DECOMMISSION_DATE_CHRONOLOGICAL_ERROR_MESSAGE:
    'Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng',
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockCallRpc = vi.mocked(callRpc)
const mockReadExcelFile = vi.mocked(readExcelFile)
const mockWorksheetToJson = vi.mocked(worksheetToJson)

function createMockFile(name = 'equipment-import.xlsx'): File {
  return new File(['dummy'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('ImportEquipmentDialog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockReadExcelFile.mockResolvedValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} as never },
      _workbook: {} as never,
    } as Awaited<ReturnType<typeof readExcelFile>>)

    mockCallRpc.mockResolvedValue({
      success: true,
      inserted: 1,
      failed: 0,
      total: 1,
      details: [],
    })
  })

  it('normalizes Date-valued ngay_ngung_su_dung from uploaded Excel rows before bulk import RPC submission', async () => {
    mockWorksheetToJson.mockResolvedValue([
      {
        'Khoa/phòng quản lý': 'Khoa Nội',
        'Người sử dụng': 'Nguyễn Văn A',
        'Tình trạng': 'Ngưng sử dụng',
        'Vị trí lắp đặt': 'Phòng 101',
        'Ngày đưa vào sử dụng': '01/01/2025',
        'Ngày ngừng sử dụng': new Date('2025-01-15T00:00:00.000Z'),
      },
    ])

    render(
      <ImportEquipmentDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    fireEvent.change(screen.getByLabelText('Chọn file'), {
      target: { files: [createMockFile()] },
    })

    await waitFor(() => {
      expect(screen.getByText(/tìm thấy/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /nhập 1 thiet bi/i }))

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: 'equipment_bulk_import',
          args: {
            p_items: [
              expect.objectContaining({
                khoa_phong_quan_ly: 'Khoa Nội',
                nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
                tinh_trang_hien_tai: 'Ngưng sử dụng',
                vi_tri_lap_dat: 'Phòng 101',
                ngay_dua_vao_su_dung: '2025-01-01',
                ngay_ngung_su_dung: '2025-01-15',
              }),
            ],
          },
        })
      )
    })
  })
})
