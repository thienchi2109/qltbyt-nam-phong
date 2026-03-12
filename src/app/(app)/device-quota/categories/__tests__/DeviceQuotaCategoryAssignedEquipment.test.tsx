import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
