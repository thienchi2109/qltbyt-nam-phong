import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'

const mockOpenDeleteDialog = vi.fn()

vi.mock('../_hooks/useEquipmentContext', () => ({
  useEquipmentContext: () => ({
    openDeleteDialog: mockOpenDeleteDialog,
  }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../_components/EquipmentDetailDialog/EquipmentDetailDetailsTab', () => ({
  EquipmentDetailDetailsTab: ({ children }: { children?: React.ReactNode }) => (
    <div>Details tab content{children}</div>
  ),
}))

vi.mock('../_components/EquipmentDetailDialog/EquipmentDetailFilesTab', () => ({
  EquipmentDetailFilesTab: () => <div>Files tab content</div>,
}))

vi.mock('../_components/EquipmentDetailDialog/EquipmentDetailHistoryTab', () => ({
  EquipmentDetailHistoryTab: () => <div>History tab content</div>,
}))

vi.mock('../_components/EquipmentDetailDialog/EquipmentDetailUsageTab', () => ({
  EquipmentDetailUsageTab: () => <div>Usage tab content</div>,
}))

vi.mock('../_components/EquipmentDetailDialog/EquipmentDetailEditForm', () => ({
  EquipmentDetailEditForm: () => <form />,
}))

vi.mock('../_components/EquipmentDetailDialog/hooks/useEquipmentHistory', () => ({
  useEquipmentHistory: () => ({
    history: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('../_components/EquipmentDetailDialog/hooks/useEquipmentAttachments', () => ({
  useEquipmentAttachments: () => ({
    attachments: [],
    isLoading: false,
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    isAdding: false,
    isDeleting: false,
  }),
}))

const mockUpdateEquipment = vi.fn()
vi.mock('../_components/EquipmentDetailDialog/hooks/useEquipmentUpdate', () => ({
  useEquipmentUpdate: () => ({
    updateEquipment: mockUpdateEquipment,
    isPending: false,
    error: null,
  }),
}))

// Import after mocks
import { EquipmentDetailDialog } from '../_components/EquipmentDetailDialog'

describe('EquipmentDetailDialog tabs', () => {
  const equipment = {
    id: 1,
    ma_thiet_bi: 'EQ-001',
    ten_thiet_bi: 'Máy siêu âm',
    khoa_phong_quan_ly: 'Khoa Nội',
  } as any

  const baseProps = {
    equipment,
    open: true,
    onOpenChange: vi.fn(),
    user: { id: 1, role: 'admin' } as any,
    isRegionalLeader: false,
    onGenerateProfileSheet: vi.fn(),
    onGenerateDeviceLabel: vi.fn(),
    onEquipmentUpdated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        writable: true,
        value: vi.fn(),
      })
    }
  })

  it('renders details tab by default', () => {
    render(<EquipmentDetailDialog {...baseProps} />)

    expect(screen.getByText('Details tab content')).toBeInTheDocument()
  })

  it('switches to files tab', async () => {
    render(<EquipmentDetailDialog {...baseProps} />)

    const filesTab = screen.getByRole('tab', { name: 'File đính kèm' })
    fireEvent.mouseDown(filesTab)
    fireEvent.click(filesTab)

    expect(await screen.findByText('Files tab content')).toBeInTheDocument()
  })

  it('switches to history tab', async () => {
    render(<EquipmentDetailDialog {...baseProps} />)

    const historyTab = screen.getByRole('tab', { name: 'Lịch sử' })
    fireEvent.mouseDown(historyTab)
    fireEvent.click(historyTab)

    expect(await screen.findByText('History tab content')).toBeInTheDocument()
  })

  it('switches to usage tab', async () => {
    render(<EquipmentDetailDialog {...baseProps} />)

    const usageTab = screen.getByRole('tab', { name: 'Nhật ký sử dụng' })
    fireEvent.mouseDown(usageTab)
    fireEvent.click(usageTab)

    expect(await screen.findByText('Usage tab content')).toBeInTheDocument()
  })
})
