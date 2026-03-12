import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock useChat from @ai-sdk/react
const mockSendMessage = vi.fn()
const mockStop = vi.fn()
const mockSetMessages = vi.fn()
vi.mock('@ai-sdk/react', () => ({
    useChat: () => ({
        messages: [],
        status: 'ready' as const,
        sendMessage: mockSendMessage,
        stop: mockStop,
        setMessages: mockSetMessages,
        error: null,
    }),
}))

// Mock DefaultChatTransport from ai — must be constructable (used with `new`)
vi.mock('ai', () => {
    class MockTransport { }
    return { DefaultChatTransport: MockTransport }
})

// Mock TenantSelectionContext
vi.mock('@/contexts/TenantSelectionContext', () => ({
    useTenantSelection: () => ({
        selectedFacilityId: 1,
        showSelector: false,
        shouldFetchData: true,
    }),
}))

import { AssistantPanel } from '../AssistantPanel'

describe('AssistantPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders panel header with title when open', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByText('Trợ lý ảo CVMEMS')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
        render(<AssistantPanel isOpen={false} onClose={vi.fn()} />)

        expect(screen.queryByText('Trợ lý ảo CVMEMS')).not.toBeInTheDocument()
    })

    it('renders status dot indicator', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByTestId('assistant-status-dot')).toBeInTheDocument()
    })

    it('renders close button in header', () => {
        const onClose = vi.fn()
        render(<AssistantPanel isOpen={true} onClose={onClose} />)

        const closeButton = screen.getByLabelText('Đóng')
        fireEvent.click(closeButton)
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('renders reset button in header', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByLabelText('Đặt lại cuộc trò chuyện')).toBeInTheDocument()
    })

    it('clears messages when reset is clicked', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        fireEvent.click(screen.getByLabelText('Đặt lại cuộc trò chuyện'))
        expect(mockSetMessages).toHaveBeenCalledWith([])
    })

    it('renders the composer input area', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByPlaceholderText('Hỏi AI về thiết bị, bảo trì...')).toBeInTheDocument()
    })

    it('renders disclaimer footer', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByText(/kết quả mang tính tham khảo/i)).toBeInTheDocument()
    })

    it('has z-[998] layering per contract', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const panel = screen.getByTestId('assistant-panel')
        expect(panel.className).toContain('z-[998]')
    })
})
