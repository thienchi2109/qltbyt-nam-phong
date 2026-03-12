import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import {
    MappingPreviewCountBadge,
    MappingPreviewFooterNote,
    MappingPreviewLoadingState,
    MappingPreviewEquipmentItem,
} from '../_components/MappingPreviewPrimitives'

// ============================================
// MappingPreviewCountBadge
// ============================================

describe('MappingPreviewCountBadge', () => {
    it('renders count with label', () => {
        render(<MappingPreviewCountBadge count={5} label="thiết bị đã chọn" />)
        expect(screen.getByText('5 thiết bị đã chọn')).toBeInTheDocument()
    })

    it('renders zero count', () => {
        render(<MappingPreviewCountBadge count={0} label="thiết bị đã chọn" />)
        expect(screen.getByText('0 thiết bị đã chọn')).toBeInTheDocument()
    })
})

// ============================================
// MappingPreviewFooterNote
// ============================================

describe('MappingPreviewFooterNote', () => {
    it('renders the provided message', () => {
        render(
            <MappingPreviewFooterNote message="Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu" />
        )
        expect(
            screen.getByText(/Đây chỉ là gợi ý phân loại/)
        ).toBeInTheDocument()
    })

    it('renders with info icon', () => {
        const { container } = render(
            <MappingPreviewFooterNote message="Test note" />
        )
        expect(container.querySelector('[data-testid="footer-note"]')).toBeInTheDocument()
    })
})

// ============================================
// MappingPreviewLoadingState
// ============================================

describe('MappingPreviewLoadingState', () => {
    it('renders skeleton items', () => {
        render(<MappingPreviewLoadingState />)
        const skeletons = screen.getAllByTestId('equipment-skeleton')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders custom count of skeletons', () => {
        render(<MappingPreviewLoadingState count={5} />)
        const skeletons = screen.getAllByTestId('equipment-skeleton')
        expect(skeletons).toHaveLength(5)
    })
})

// ============================================
// MappingPreviewEquipmentItem
// ============================================

describe('MappingPreviewEquipmentItem', () => {
    const item = {
        id: 1,
        ma_thiet_bi: 'TB-001234',
        ten_thiet_bi: 'Máy X-quang KTS Discovery XR656',
        model: null,
        serial: null,
        hang_san_xuat: null,
        khoa_phong_quan_ly: 'Khoa Chẩn đoán hình ảnh',
        tinh_trang: null,
    }

    it('renders equipment name and code', () => {
        render(
            <MappingPreviewEquipmentItem
                item={item}
                isExcluded={false}
                onToggle={() => { }}
            />
        )
        expect(screen.getByText('Máy X-quang KTS Discovery XR656')).toBeInTheDocument()
        expect(screen.getByText('TB-001234')).toBeInTheDocument()
    })

    it('renders department badge when present', () => {
        render(
            <MappingPreviewEquipmentItem
                item={item}
                isExcluded={false}
                onToggle={() => { }}
            />
        )
        expect(screen.getByText('Khoa Chẩn đoán hình ảnh')).toBeInTheDocument()
    })

    it('shows line-through and remove button label when not excluded', () => {
        render(
            <MappingPreviewEquipmentItem
                item={item}
                isExcluded={false}
                onToggle={() => { }}
            />
        )
        expect(screen.getByRole('button', { name: /loại bỏ/i })).toBeInTheDocument()
        const name = screen.getByText('Máy X-quang KTS Discovery XR656')
        expect(name).not.toHaveClass('line-through')
    })

    it('shows restore button and line-through when excluded', () => {
        render(
            <MappingPreviewEquipmentItem
                item={item}
                isExcluded={true}
                onToggle={() => { }}
            />
        )
        expect(screen.getByRole('button', { name: /khôi phục/i })).toBeInTheDocument()
        const name = screen.getByText('Máy X-quang KTS Discovery XR656')
        expect(name).toHaveClass('line-through')
    })

    it('calls onToggle when button is clicked', () => {
        const onToggle = vi.fn()
        render(
            <MappingPreviewEquipmentItem
                item={item}
                isExcluded={false}
                onToggle={onToggle}
            />
        )
        fireEvent.click(screen.getByRole('button', { name: /loại bỏ/i }))
        expect(onToggle).toHaveBeenCalledTimes(1)
    })
})
