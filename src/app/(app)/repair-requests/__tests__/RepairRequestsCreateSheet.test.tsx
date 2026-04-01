import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  closeAllDialogs: vi.fn(),
  createMutate: vi.fn(),
}))

const contextValue = {
  dialogState: {
    isCreateOpen: true,
    preSelectedEquipment: null,
  },
  closeAllDialogs: mocks.closeAllDialogs,
  createMutation: {
    mutate: mocks.createMutate,
    isPending: false,
  },
  user: { full_name: 'Test User', username: 'tester' },
  canSetRepairUnit: true,
  assistantDraft: null,
}

vi.mock('@/lib/rpc-client', () => ({
  callRpc: mocks.callRpc,
}))

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => false,
}))

vi.mock('../_hooks/useRepairRequestsContext', () => ({
  useRepairRequestsContext: () => contextValue,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type = 'button', disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date | undefined) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date(2026, 2, 20))}>
      Pick calendar date
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { RepairRequestsCreateSheet } from '../_components/RepairRequestsCreateSheet'

function setAssistantDraft(draft: typeof contextValue.assistantDraft) {
  contextValue.assistantDraft = draft
}

describe('RepairRequestsCreateSheet assistant draft hydration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    contextValue.dialogState.isCreateOpen = true
    contextValue.dialogState.preSelectedEquipment = null
    setAssistantDraft(null)
  })

  it('hydrates non-equipment draft fields even before equipment options are loaded', async () => {
    mocks.callRpc.mockImplementation(async ({ args }: { args: { p_q?: string } }) => {
      if (args.p_q === 'Máy siêu âm A (TB-001)') {
        return [
          {
            id: 101,
            ma_thiet_bi: 'TB-001',
            ten_thiet_bi: 'Máy siêu âm A',
            khoa_phong_quan_ly: 'CDHA',
          },
        ]
      }
      return []
    })

    setAssistantDraft({
      equipment: {
        thiet_bi_id: 101,
        ma_thiet_bi: 'TB-001',
        ten_thiet_bi: 'Máy siêu âm A',
      },
      formData: {
        thiet_bi_id: 101,
        mo_ta_su_co: 'Mất nguồn đột ngột',
        hang_muc_sua_chua: 'Kiểm tra bo nguồn',
        ngay_mong_muon_hoan_thanh: '2026-03-20',
        don_vi_thuc_hien: 'thue_ngoai',
        ten_don_vi_thue: 'Công ty ABC',
      },
      missingFields: [],
      reviewNotes: [],
    })

    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByLabelText('Mô tả sự cố')).toHaveValue('Mất nguồn đột ngột')
    })

    expect(screen.getByLabelText('Các hạng mục yêu cầu sửa chữa')).toHaveValue('Kiểm tra bo nguồn')
    expect(screen.getByLabelText('Tên đơn vị được thuê')).toHaveValue('Công ty ABC')
    expect(screen.getByText('20/03/2026')).toBeInTheDocument()
  })

  it('does not shift the desired date when hydrating a date-only string', async () => {
    const RealDate = Date

    class ShiftedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 1 && typeof args[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
          super(`${args[0]}T00:00:00.000Z`)
          this.setHours(this.getHours() - 7)
          return
        }
        // @ts-expect-error test double constructor forwarding
        super(...args)
      }

      static now() {
        return RealDate.now()
      }

      static parse(value: string) {
        return RealDate.parse(value)
      }

      static UTC(...args: Parameters<typeof Date.UTC>) {
        return RealDate.UTC(...args)
      }
    }

    vi.stubGlobal('Date', ShiftedDate)
    mocks.callRpc.mockResolvedValue([])

    setAssistantDraft({
      equipment: {},
      formData: {
        mo_ta_su_co: 'Lỗi màn hình',
        hang_muc_sua_chua: 'Kiểm tra hiển thị',
        ngay_mong_muon_hoan_thanh: '2026-03-20',
      },
      missingFields: [],
      reviewNotes: [],
    })

    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByText('20/03/2026')).toBeInTheDocument()
    })
  })

  it('ignores invalid draft dates instead of normalizing them to another calendar day', async () => {
    mocks.callRpc.mockResolvedValue([])

    setAssistantDraft({
      equipment: {},
      formData: {
        mo_ta_su_co: 'Lỗi màn hình',
        hang_muc_sua_chua: 'Kiểm tra hiển thị',
        ngay_mong_muon_hoan_thanh: '2026-02-31',
      },
      missingFields: [],
      reviewNotes: [],
    })

    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByText('Chọn ngày')).toBeInTheDocument()
    })

    expect(screen.queryByText('03/03/2026')).not.toBeInTheDocument()
  })

  it('preserves manual non-equipment field edits after draft lookup resolves as unresolved', async () => {
    let releaseLookup: (() => void) | null = null

    mocks.callRpc.mockImplementation(({ args }: { args: { p_q?: string } }) => {
      if (args.p_q === 'Máy siêu âm A (TB-001)') {
        return new Promise(resolve => {
          releaseLookup = () => resolve([])
        })
      }
      return Promise.resolve([])
    })

    setAssistantDraft({
      equipment: {
        thiet_bi_id: 999,
        ma_thiet_bi: 'TB-001',
        ten_thiet_bi: 'Máy siêu âm A',
      },
      formData: {
        mo_ta_su_co: 'Lỗi cần chọn lại thiết bị',
        hang_muc_sua_chua: 'Kiểm tra lại',
      },
      missingFields: [],
      reviewNotes: [],
    })

    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByLabelText('Mô tả sự cố')).toHaveValue('Lỗi cần chọn lại thiết bị')
    })

    fireEvent.change(screen.getByLabelText('Mô tả sự cố'), {
      target: { value: 'Người dùng đã sửa mô tả' },
    })

    expect(screen.getByLabelText('Mô tả sự cố')).toHaveValue('Người dùng đã sửa mô tả')

    await waitFor(() => {
      expect(mocks.callRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ p_q: 'Máy siêu âm A (TB-001)' }),
        }),
      )
    })

    releaseLookup?.()

    await waitFor(() => {
      expect(screen.getByText('⚠️ Thiết bị trong bản nháp không tìm thấy ở cơ sở hiện tại. Vui lòng chọn thiết bị thủ công.')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Mô tả sự cố')).toHaveValue('Người dùng đã sửa mô tả')
  })

  it('does not overwrite manual equipment search input while draft lookup is pending', async () => {
    let releaseLookup: (() => void) | null = null

    mocks.callRpc.mockImplementation(({ args }: { args: { p_q?: string } }) => {
      if (args.p_q === 'Máy siêu âm A (TB-001)') {
        return new Promise(resolve => {
          releaseLookup = () => resolve([])
        })
      }
      if (args.p_q === 'Máy siêu âm') {
        return Promise.resolve([
          {
            id: 202,
            ma_thiet_bi: 'TB-202',
            ten_thiet_bi: 'Máy siêu âm B',
            khoa_phong_quan_ly: 'CDHA',
          },
        ])
      }
      return Promise.resolve([])
    })

    setAssistantDraft({
      equipment: {
        thiet_bi_id: 999,
        ma_thiet_bi: 'TB-001',
        ten_thiet_bi: 'Máy siêu âm A',
      },
      formData: {
        mo_ta_su_co: 'Lỗi cần chọn lại thiết bị',
        hang_muc_sua_chua: 'Kiểm tra lại',
      },
      missingFields: [],
      reviewNotes: [],
    })

    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(mocks.callRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ p_q: 'Máy siêu âm A (TB-001)' }),
        }),
      )
    })

    fireEvent.change(screen.getByLabelText('Thiết bị'), {
      target: { value: 'Máy siêu âm' },
    })

    expect(screen.getByLabelText('Thiết bị')).toHaveValue('Máy siêu âm')

    releaseLookup?.()

    await waitFor(() => {
      expect(screen.getByLabelText('Thiết bị')).toHaveValue('Máy siêu âm')
    })
  })

  it('clears unresolved draft warning after manual equipment selection', async () => {
    mocks.callRpc.mockImplementation(async ({ args }: { args: { p_q?: string } }) => {
      if (args.p_q === 'Máy siêu âm') {
        return [
          {
            id: 202,
            ma_thiet_bi: 'TB-202',
            ten_thiet_bi: 'Máy siêu âm B',
            khoa_phong_quan_ly: 'CDHA',
          },
        ]
      }
      return []
    })

    setAssistantDraft({
      equipment: {
        thiet_bi_id: 999,
        ma_thiet_bi: 'TB-999',
        ten_thiet_bi: 'Thiết bị không tồn tại',
      },
      formData: {
        mo_ta_su_co: 'Lỗi cần chọn lại thiết bị',
        hang_muc_sua_chua: 'Kiểm tra lại',
      },
      missingFields: [],
      reviewNotes: [],
    })

    render(<RepairRequestsCreateSheet />)

    await waitFor(() => {
      expect(screen.getByText('⚠️ Thiết bị trong bản nháp không tìm thấy ở cơ sở hiện tại. Vui lòng chọn thiết bị thủ công.')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Thiết bị'), {
      target: { value: 'Máy siêu âm' },
    })

    await waitFor(() => {
      expect(screen.getByText('Máy siêu âm B')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Máy siêu âm B'))

    await waitFor(() => {
      expect(screen.queryByText('⚠️ Thiết bị trong bản nháp không tìm thấy ở cơ sở hiện tại. Vui lòng chọn thiết bị thủ công.')).not.toBeInTheDocument()
    })
  })

  it('renders equipment suggestions as semantic buttons before selection', async () => {
    mocks.callRpc.mockImplementation(({ args }: { args: { p_q?: string } }) => {
      if (args.p_q === 'Máy siêu âm') {
        return Promise.resolve([
          {
            id: 202,
            ma_thiet_bi: 'TB-202',
            ten_thiet_bi: 'Máy siêu âm B',
            khoa_phong_quan_ly: 'CDHA',
          },
        ])
      }

      return Promise.resolve([])
    })

    render(<RepairRequestsCreateSheet />)

    fireEvent.change(screen.getByLabelText('Thiết bị'), {
      target: { value: 'Máy siêu âm' },
    })

    const suggestionButton = await screen.findByRole('button', {
      name: /Máy siêu âm B/i,
    })

    suggestionButton.focus()
    expect(suggestionButton).toHaveFocus()
    fireEvent.click(suggestionButton)

    await waitFor(() => {
      expect(screen.getByLabelText('Thiết bị')).toHaveValue('Máy siêu âm B (TB-202)')
    })
  })

  it('does not depend on searchQuery in the hydration effect dependency list', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx'),
      'utf8',
    )

    const hydrationEffectDependencies = source.match(
      /React\.useEffect\(\(\) => \{[\s\S]*?\n  \}, \[([\s\S]*?)\]\)/,
    )?.[1]

    expect(hydrationEffectDependencies).toBeDefined()
    expect(hydrationEffectDependencies).not.toContain('searchQuery')
  })
})

describe('RepairRequestsCreateSheet equipment search debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    contextValue.dialogState.isCreateOpen = true
    contextValue.dialogState.preSelectedEquipment = null
    setAssistantDraft(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call equipment_list immediately on keystroke and only calls after debounce window', async () => {
    mocks.callRpc.mockResolvedValue([
      {
        id: 202,
        ma_thiet_bi: 'TB-202',
        ten_thiet_bi: 'Máy siêu âm B',
        khoa_phong_quan_ly: 'CDHA',
      },
    ])

    render(<RepairRequestsCreateSheet />)

    fireEvent.change(screen.getByLabelText('Thiết bị'), {
      target: { value: 'Máy siêu âm' },
    })

    expect(mocks.callRpc).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(mocks.callRpc).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
      await Promise.resolve()
    })
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: 'equipment_list',
        args: expect.objectContaining({ p_q: 'Máy siêu âm' }),
      }),
    )
  })

  it('coalesces rapid typing into a single call for the latest query', async () => {
    mocks.callRpc.mockResolvedValue([])

    render(<RepairRequestsCreateSheet />)

    const equipmentInput = screen.getByLabelText('Thiết bị')
    fireEvent.change(equipmentInput, { target: { value: 'M' } })
    fireEvent.change(equipmentInput, { target: { value: 'Má' } })
    fireEvent.change(equipmentInput, { target: { value: 'Máy' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)

    expect(mocks.callRpc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fn: 'equipment_list',
        args: expect.objectContaining({ p_q: 'Máy' }),
      }),
    )
  })

  it('clears stale suggestions when latest equipment search fails', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([
        {
          id: 202,
          ma_thiet_bi: 'TB-202',
          ten_thiet_bi: 'Máy siêu âm B',
          khoa_phong_quan_ly: 'CDHA',
        },
      ])
      .mockRejectedValueOnce(new Error('network error'))

    render(<RepairRequestsCreateSheet />)

    const equipmentInput = screen.getByLabelText('Thiết bị')

    fireEvent.change(equipmentInput, { target: { value: 'Máy siêu âm' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(screen.getByText('Máy siêu âm B')).toBeInTheDocument()

    fireEvent.change(equipmentInput, { target: { value: 'Máy X-quang' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(mocks.callRpc).toHaveBeenCalledTimes(2)
    expect(mocks.callRpc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fn: 'equipment_list',
        args: expect.objectContaining({ p_q: 'Máy X-quang' }),
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByText('Máy siêu âm B')).not.toBeInTheDocument()
    expect(screen.getByText('Không tìm thấy kết quả phù hợp')).toBeInTheDocument()
  })

  it('does not show no-results while debounced search is pending', async () => {
    mocks.callRpc.mockResolvedValue([])

    render(<RepairRequestsCreateSheet />)

    fireEvent.change(screen.getByLabelText('Thiết bị'), {
      target: { value: 'Không tồn tại' },
    })

    expect(screen.queryByText('Không tìm thấy kết quả phù hợp')).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(screen.getByText('Không tìm thấy kết quả phù hợp')).toBeInTheDocument()
  })

  it('hides stale suggestions during debounce window for a new query', async () => {
    mocks.callRpc
      .mockResolvedValueOnce([
        {
          id: 202,
          ma_thiet_bi: 'TB-202',
          ten_thiet_bi: 'Máy siêu âm B',
          khoa_phong_quan_ly: 'CDHA',
        },
      ])
      .mockResolvedValueOnce([])

    render(<RepairRequestsCreateSheet />)

    const equipmentInput = screen.getByLabelText('Thiết bị')

    fireEvent.change(equipmentInput, { target: { value: 'Máy siêu âm' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(screen.getByText('Máy siêu âm B')).toBeInTheDocument()

    fireEvent.change(equipmentInput, { target: { value: 'Máy X-quang' } })

    expect(screen.queryByText('Máy siêu âm B')).not.toBeInTheDocument()
    expect(screen.queryByText('Không tìm thấy kết quả phù hợp')).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(screen.getByText('Không tìm thấy kết quả phù hợp')).toBeInTheDocument()
  })

  it('hides stale suggestions immediately on input change before effect tick', async () => {
    mocks.callRpc.mockResolvedValue([
      {
        id: 202,
        ma_thiet_bi: 'TB-202',
        ten_thiet_bi: 'Máy siêu âm B',
        khoa_phong_quan_ly: 'CDHA',
      },
    ])

    render(<RepairRequestsCreateSheet />)

    const equipmentInput = screen.getByLabelText('Thiết bị')

    fireEvent.change(equipmentInput, { target: { value: 'Máy siêu âm' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })
    expect(screen.getByText('Máy siêu âm B')).toBeInTheDocument()

    fireEvent.change(equipmentInput, { target: { value: 'Máy X-quang' } })

    expect(screen.queryByText('Máy siêu âm B')).not.toBeInTheDocument()
    expect(screen.queryByText('Không tìm thấy kết quả phù hợp')).not.toBeInTheDocument()
  })
})
