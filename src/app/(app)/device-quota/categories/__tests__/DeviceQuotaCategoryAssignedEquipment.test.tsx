import React from 'react'
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DeviceQuotaCategoryAssignedEquipment } from '../_components/DeviceQuotaCategoryAssignedEquipment'
import { callRpc } from '@/lib/rpc-client'
import type { EquipmentPreviewItem } from '@/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives'

vi.mock('@/lib/rpc-client', () => ({
    callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

const sampleEquipment: EquipmentPreviewItem[] = [
    {
        id: 101,
        ma_thiet_bi: 'TB-001',
        ten_thiet_bi: 'Máy X quang GE OEC',
        model: 'OEC 9900',
        serial: 'SN12345',
        hang_san_xuat: 'GE Healthcare',
        khoa_phong_quan_ly: 'Khoa CĐHA',
        tinh_trang: 'Hoạt động',
    },
    {
        id: 102,
        ma_thiet_bi: 'TB-002',
        ten_thiet_bi: 'Máy X quang Shimadzu',
        model: 'RADspeed Pro',
        serial: 'SN67890',
        hang_san_xuat: 'Shimadzu',
        khoa_phong_quan_ly: 'Khoa Cấp cứu',
        tinh_trang: 'Bảo trì',
    },
]

describe('DeviceQuotaCategoryAssignedEquipment', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows loading skeletons while fetching', () => {
        mockCallRpc.mockReturnValue(new Promise(() => { })) // never resolves

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={42} donViId={1} />,
            { wrapper: createWrapper() }
        )

        expect(screen.getAllByTestId('equipment-skeleton').length).toBeGreaterThan(0)
    })

    it('renders equipment table with all columns when data is returned', async () => {
        mockCallRpc.mockResolvedValue(sampleEquipment)

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={42} donViId={1} />,
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            // Device codes
            expect(screen.getByText('TB-001')).toBeInTheDocument()
            expect(screen.getByText('TB-002')).toBeInTheDocument()
        })

        // Device names
        expect(screen.getByText('Máy X quang GE OEC')).toBeInTheDocument()
        expect(screen.getByText('Máy X quang Shimadzu')).toBeInTheDocument()

        // Model
        expect(screen.getByText('OEC 9900')).toBeInTheDocument()
        expect(screen.getByText('RADspeed Pro')).toBeInTheDocument()

        // Serial
        expect(screen.getByText('SN12345')).toBeInTheDocument()
        expect(screen.getByText('SN67890')).toBeInTheDocument()

        // Department
        expect(screen.getByText('Khoa CĐHA')).toBeInTheDocument()
        expect(screen.getByText('Khoa Cấp cứu')).toBeInTheDocument()

        // Status
        expect(screen.getByText('Hoạt động')).toBeInTheDocument()
        expect(screen.getByText('Bảo trì')).toBeInTheDocument()
    })

    it('uses panel presentation with horizontal table scroll and long-text guards', async () => {
        const longName = 'Máy siêu âm Doppler màu tim mạch cấu hình cao dùng cho phòng can thiệp với tên thiết bị rất dài'
        mockCallRpc.mockResolvedValue([
            {
                ...sampleEquipment[0],
                ten_thiet_bi: longName,
                model: 'Model-name-with-a-very-long-value-that-must-not-overlap',
                serial: 'Serial-number-with-a-very-long-value-that-must-not-overlap',
                khoa_phong_quan_ly: 'Khoa phòng quản lý thiết bị có tên rất dài',
            },
        ])

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={42} donViId={1} variant="panel" />,
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(screen.getByText(longName)).toBeInTheDocument()
        })

        expect(screen.getByTestId('assigned-equipment-table-scroll')).toHaveClass('overflow-x-auto')
        expect(screen.getByRole('table')).toHaveClass('min-w-[760px]')
        expect(screen.getByText(longName)).toHaveClass('line-clamp-2')
        expect(screen.getByText(longName)).toHaveAttribute('title', longName)
        expect(screen.getByText(/Model-name/)).toHaveClass('truncate')
        expect(screen.getByText(/Serial-number/)).toHaveClass('truncate')
        expect(screen.getByText(/Khoa phòng quản lý/)).toHaveClass('truncate')
    })

    it('shows empty state when no equipment is assigned', async () => {
        mockCallRpc.mockResolvedValue([])

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={42} donViId={1} />,
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(screen.getByText('Chưa có thiết bị nào được gán')).toBeInTheDocument()
        })
    })

    it('does not present a failed assigned-equipment RPC as an empty assignment', async () => {
        mockCallRpc.mockRejectedValue(new Error('42702: column reference "id" is ambiguous'))

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={24} donViId={17} />,
            { wrapper: createWrapper() }
        )

        await waitForElementToBeRemoved(() => screen.queryAllByTestId('equipment-skeleton'))

        expect(screen.queryByText('Chưa có thiết bị nào được gán')).not.toBeInTheDocument()
        expect(screen.getByText('Không thể tải danh sách thiết bị được gán')).toBeInTheDocument()
    })

    it('does not render exclude or restore buttons (read-only)', async () => {
        mockCallRpc.mockResolvedValue(sampleEquipment)

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={42} donViId={1} />,
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(screen.getByText('TB-001')).toBeInTheDocument()
        })

        expect(screen.queryByLabelText('Loại bỏ')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Khôi phục')).not.toBeInTheDocument()
    })

    it('calls RPC with correct arguments', async () => {
        mockCallRpc.mockResolvedValue([])

        render(
            <DeviceQuotaCategoryAssignedEquipment nhomId={99} donViId={7} />,
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockCallRpc).toHaveBeenCalledWith({
                fn: 'dinh_muc_thiet_bi_by_nhom',
                args: { p_nhom_id: 99, p_don_vi: 7 },
            })
        })
    })
})
