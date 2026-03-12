import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FilterBottomSheet, type EquipmentFilterData } from '../../equipment/filter-bottom-sheet'

const emptyFilterData: EquipmentFilterData = {
    status: [{ id: 'active', label: 'Đang sử dụng', count: 10 }],
    department: [],
    location: [],
    user: [],
    classification: [],
    fundingSource: [],
}

describe('FilterBottomSheet (regression)', () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        data: emptyFilterData,
        columnFilters: [],
        onApply: vi.fn(),
        onClearAll: vi.fn(),
    }

    it('renders filter section labels when open', () => {
        render(<FilterBottomSheet {...defaultProps} />)

        expect(screen.getByText('Trạng thái')).toBeInTheDocument()
        expect(screen.getByText('Đang sử dụng')).toBeInTheDocument()
    })

    it('calls onOpenChange(false) when close button is clicked', () => {
        const onOpenChange = vi.fn()
        render(<FilterBottomSheet {...defaultProps} onOpenChange={onOpenChange} />)

        const closeButton = screen.getByLabelText('Đóng bộ lọc')
        fireEvent.click(closeButton)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) on backdrop click', () => {
        const onOpenChange = vi.fn()
        render(<FilterBottomSheet {...defaultProps} onOpenChange={onOpenChange} />)

        const backdrop = screen.getByTestId('mobile-bottom-sheet-backdrop')
        fireEvent.click(backdrop)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('does not render when closed', () => {
        render(<FilterBottomSheet {...defaultProps} open={false} />)

        expect(screen.queryByText('Trạng thái')).not.toBeInTheDocument()
    })
})
