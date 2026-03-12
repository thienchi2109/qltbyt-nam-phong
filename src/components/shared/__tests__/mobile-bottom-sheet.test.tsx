import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MobileBottomSheet } from '../mobile-bottom-sheet'

describe('MobileBottomSheet', () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        ariaLabel: 'Test bottom sheet',
    }

    it('renders children when open', () => {
        render(
            <MobileBottomSheet {...defaultProps}>
                <p>Sheet content</p>
            </MobileBottomSheet>,
        )

        expect(screen.getByText('Sheet content')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
        render(
            <MobileBottomSheet {...defaultProps} open={false}>
                <p>Sheet content</p>
            </MobileBottomSheet>,
        )

        expect(screen.queryByText('Sheet content')).not.toBeInTheDocument()
    })

    it('calls onOpenChange(false) on Escape key press', () => {
        const onOpenChange = vi.fn()

        render(
            <MobileBottomSheet {...defaultProps} onOpenChange={onOpenChange}>
                <button>Inside</button>
            </MobileBottomSheet>,
        )

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) on backdrop click', () => {
        const onOpenChange = vi.fn()

        render(
            <MobileBottomSheet {...defaultProps} onOpenChange={onOpenChange}>
                <p>Content</p>
            </MobileBottomSheet>,
        )

        const backdrop = screen.getByTestId('mobile-bottom-sheet-backdrop')
        fireEvent.click(backdrop)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('renders a drag handle', () => {
        render(
            <MobileBottomSheet {...defaultProps}>
                <p>Content</p>
            </MobileBottomSheet>,
        )

        expect(screen.getByTestId('mobile-bottom-sheet-handle')).toBeInTheDocument()
    })

    it('has role="dialog" with correct aria-label and aria-modal', () => {
        render(
            <MobileBottomSheet {...defaultProps} ariaLabel="Filter sheet">
                <p>Content</p>
            </MobileBottomSheet>,
        )

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAttribute('aria-label', 'Filter sheet')
    })

    it('applies custom className to the sheet panel', () => {
        render(
            <MobileBottomSheet {...defaultProps} className="custom-class">
                <p>Content</p>
            </MobileBottomSheet>,
        )

        const dialog = screen.getByRole('dialog')
        // The className should be on the inner panel, not the outer container
        const panel = dialog.querySelector('.custom-class')
        expect(panel).toBeInTheDocument()
    })
})
