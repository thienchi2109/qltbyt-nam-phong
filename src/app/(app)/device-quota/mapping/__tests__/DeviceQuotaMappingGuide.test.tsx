import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaMappingGuide } from '../_components/DeviceQuotaMappingGuide'

// ============================================
// localStorage mock
// ============================================

const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value
        }),
        clear: () => {
            store = {}
        },
    }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ============================================
// Tests
// ============================================

describe('DeviceQuotaMappingGuide', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorageMock.clear()
    })

    it('renders 3-step manual mapping instructions', () => {
        render(<DeviceQuotaMappingGuide />)

        expect(screen.getByText(/Hướng dẫn phân loại thủ công/)).toBeInTheDocument()
        expect(screen.getByText(/Chọn thiết bị/)).toBeInTheDocument()
        expect(screen.getByText(/Chọn danh mục/)).toBeInTheDocument()
        expect(screen.getByText(/Phân loại/)).toBeInTheDocument()
    })

    it('mentions that AI suggestion is resource-heavy', () => {
        render(<DeviceQuotaMappingGuide />)

        expect(screen.getByText(/tài nguyên/i)).toBeInTheDocument()
    })

    it('dismisses the guide when "Đã hiểu" button is clicked', () => {
        render(<DeviceQuotaMappingGuide />)

        const dismissButton = screen.getByRole('button', { name: /đã hiểu/i })
        fireEvent.click(dismissButton)

        expect(screen.queryByText(/Hướng dẫn phân loại thủ công/)).not.toBeInTheDocument()
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'mapping-guide-dismissed',
            'true'
        )
    })

    it('does not render when previously dismissed via localStorage', () => {
        localStorageMock.getItem.mockReturnValue('true')

        render(<DeviceQuotaMappingGuide />)

        expect(screen.queryByText(/Hướng dẫn phân loại thủ công/)).not.toBeInTheDocument()
    })
})
