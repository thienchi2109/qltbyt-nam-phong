import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

class ResizeObserverMock implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        void callback
    }

    observe(target: Element, options?: ResizeObserverOptions) {
        void target
        void options
    }

    unobserve(target: Element) {
        void target
    }

    disconnect() { }
}

// jsdom does not implement matchMedia or ResizeObserver — polyfill for Dialog and SVG connectors
beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    })

    globalThis.ResizeObserver = ResizeObserverMock
})

import { DeviceQuotaMappingPreviewDialog as MappingPreviewDialog } from '../_components/DeviceQuotaMappingPreviewDialog'
import type { Category } from '../_components/DeviceQuotaMappingContext'

// Mock TanStack Query's useQuery to control data fetching in tests
vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(),
}))

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
const mockUseQuery = vi.mocked(useQuery)

// ============================================
// Test Fixtures
// ============================================

const CATEGORY: Category = {
    id: 10,
    parent_id: null,
    ma_nhom: 'A.01.02',
    ten_nhom: 'Máy X-quang chẩn đoán',
    phan_loai: null,
    level: 2,
    so_luong_hien_co: 5,
}

const EQUIPMENT_LIST = [
    { id: 1, ma_thiet_bi: 'TB-001234', ten_thiet_bi: 'Máy X-quang KTS Discovery XR656', model: null, serial: null, hang_san_xuat: null, khoa_phong_quan_ly: 'Khoa Chẩn đoán hình ảnh', tinh_trang: 'Đang sử dụng' },
    { id: 2, ma_thiet_bi: 'TB-005678', ten_thiet_bi: 'Máy X-quang KTS Discovery XR657', model: null, serial: null, hang_san_xuat: null, khoa_phong_quan_ly: 'Khoa Ngoại', tinh_trang: 'Đang sử dụng' },
    { id: 3, ma_thiet_bi: 'TB-009012', ten_thiet_bi: 'Máy X-quang KTS Dung Z-00', model: null, serial: null, hang_san_xuat: null, khoa_phong_quan_ly: 'Khoa Nội', tinh_trang: 'Đang sử dụng' },
]

const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    selectedIds: new Set([1, 2, 3]),
    targetCategory: CATEGORY,
    onConfirm: vi.fn(),
    isLinking: false,
    donViId: 1,
}

// ============================================
// Setup helper: simulate useQuery returning equipment data
// ============================================

type EquipmentQueryResult = Partial<UseQueryResult<typeof EQUIPMENT_LIST, Error>>

function setupQuery(overrides: EquipmentQueryResult = {}) {
    const queryResult = {
        data: EQUIPMENT_LIST,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        isSuccess: true,
        status: 'success',
        fetchStatus: 'idle',
        ...overrides,
    } satisfies EquipmentQueryResult

    mockUseQuery.mockReturnValue(queryResult as unknown as ReturnType<typeof useQuery>)
}

// ============================================
// Tests
// ============================================

describe('DeviceQuotaMappingPreviewDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // Test 1: Renders
    it('renders dialog with title, category card, and equipment list', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        expect(screen.getByText('Xác nhận phân loại thiết bị')).toBeInTheDocument()
        expect(screen.getByText(/Vui lòng kiểm tra lại trước khi lưu/)).toBeInTheDocument()
        expect(screen.getByText('3 thiết bị đã chọn')).toBeInTheDocument()
    })

    // Test 2: Category card (renders twice: desktop + mobile)
    it('displays category info with code, name, and level badge', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        expect(screen.getAllByText('A.01.02').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Máy X-quang chẩn đoán').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Cấp 2').length).toBeGreaterThanOrEqual(1)
    })

    // Test 3: Equipment items
    it('renders equipment items with name and department badge', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        expect(screen.getByText('Máy X-quang KTS Discovery XR656')).toBeInTheDocument()
        expect(screen.getByText('TB-001234')).toBeInTheDocument()
        expect(screen.getByText('Khoa Chẩn đoán hình ảnh')).toBeInTheDocument()
    })

    // Test 4: Remove item
    it('excludes an item when remove button is clicked', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        const removeButtons = screen.getAllByRole('button', { name: /loại bỏ/i })
        fireEvent.click(removeButtons[0])

        expect(screen.getByText('2 thiết bị đã chọn')).toBeInTheDocument()
        const firstItem = screen.getByText('Máy X-quang KTS Discovery XR656')
        expect(firstItem).toHaveClass('line-through')
    })

    // Test 5: Restore item
    it('restores an excluded item when restore button is clicked', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        const removeButtons = screen.getAllByRole('button', { name: /loại bỏ/i })
        fireEvent.click(removeButtons[0])
        expect(screen.getByText('2 thiết bị đã chọn')).toBeInTheDocument()

        const restoreButton = screen.getByRole('button', { name: /khôi phục/i })
        fireEvent.click(restoreButton)

        expect(screen.getByText('3 thiết bị đã chọn')).toBeInTheDocument()
    })

    // Test 6: Confirm sends correct IDs
    it('calls onConfirm with only non-excluded IDs', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        // Exclude item with id=2 (second remove button)
        const removeButtons = screen.getAllByRole('button', { name: /loại bỏ/i })
        fireEvent.click(removeButtons[1])

        const confirmBtn = screen.getByRole('button', { name: /xác nhận phân loại/i })
        fireEvent.click(confirmBtn)

        expect(defaultProps.onConfirm).toHaveBeenCalledWith([1, 3])
    })

    // Test 7: Empty batch disables confirm
    it('disables confirm button when all items are excluded', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        const removeButtons = screen.getAllByRole('button', { name: /loại bỏ/i })
        removeButtons.forEach(btn => fireEvent.click(btn))

        expect(screen.getByText('0 thiết bị đã chọn')).toBeInTheDocument()

        const confirmBtn = screen.getByRole('button', { name: /xác nhận phân loại/i })
        expect(confirmBtn).toBeDisabled()
    })

    // Test 8: Cancel
    it('calls onOpenChange(false) when cancel button is clicked', () => {
        setupQuery()
        render(<MappingPreviewDialog {...defaultProps} />)

        const cancelBtn = screen.getByRole('button', { name: /hủy/i })
        fireEvent.click(cancelBtn)

        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })

    // Test 9: Loading state
    it('shows skeleton loading state while fetching data', () => {
        setupQuery({ data: undefined, isLoading: true, status: 'pending' })
        render(<MappingPreviewDialog {...defaultProps} />)

        const skeletons = document.querySelectorAll('[data-testid="equipment-skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
    })
})
