import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
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

    it('does not include the guide in the initial render before dismissal state hydrates', () => {
        const html = renderToStaticMarkup(<DeviceQuotaMappingGuide />)

        expect(html).not.toContain('Hướng dẫn phân loại thủ công')
    })

    it('renders 3-step manual mapping instructions', async () => {
        render(<DeviceQuotaMappingGuide />)

        await waitFor(() => {
            expect(screen.getByText(/Hướng dẫn phân loại thủ công/)).toBeInTheDocument()
        })
        expect(screen.getByText(/Chọn thiết bị/)).toBeInTheDocument()
        expect(screen.getByText(/Chọn danh mục/)).toBeInTheDocument()
        expect(screen.getByText(/Phân loại/)).toBeInTheDocument()
    })

    it('mentions that AI suggestion is resource-heavy', async () => {
        render(<DeviceQuotaMappingGuide />)

        await waitFor(() => {
            expect(screen.getByText(/tài nguyên/i)).toBeInTheDocument()
        })
    })

    it('dismisses the guide when "Đã hiểu" button is clicked', async () => {
        render(<DeviceQuotaMappingGuide />)

        const dismissButton = await screen.findByRole('button', { name: /đã hiểu/i })
        fireEvent.click(dismissButton)

        expect(screen.queryByText(/Hướng dẫn phân loại thủ công/)).not.toBeInTheDocument()
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'mapping-guide-dismissed',
            'true'
        )
    })

    it('does not render when previously dismissed via localStorage', async () => {
        localStorageMock.setItem('mapping-guide-dismissed', 'true')

        render(<DeviceQuotaMappingGuide />)

        await waitFor(() => {
            expect(screen.queryByText(/Hướng dẫn phân loại thủ công/)).not.toBeInTheDocument()
        })
    })
})
