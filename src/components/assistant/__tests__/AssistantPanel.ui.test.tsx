import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    sendMessage: vi.fn(),
    stop: vi.fn(),
    setMessages: vi.fn(),
    setQueryData: vi.fn(),
    removeQueries: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    defaultChatTransport: vi.fn(),
    useChatState: {
        messages: [] as Array<Record<string, unknown>>,
        status: 'ready' as const,
    },
}))

vi.mock('@ai-sdk/react', () => ({
    useChat: () => ({
        messages: mocks.useChatState.messages,
        status: mocks.useChatState.status,
        sendMessage: mocks.sendMessage,
        stop: mocks.stop,
        setMessages: mocks.setMessages,
        error: null,
        regenerate: vi.fn(),
        clearError: vi.fn(),
    }),
}))

vi.mock('ai', () => {
    class MockTransport {
        constructor(options: unknown) {
            mocks.defaultChatTransport(options)
        }
    }
    return {
        DefaultChatTransport: MockTransport,
        isToolUIPart: (part: { type: string }) => part.type.startsWith('tool-'),
        getToolName: (part: { type: string }) => part.type.replace('tool-', ''),
    }
})

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        setQueryData: mocks.setQueryData,
        removeQueries: mocks.removeQueries,
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mocks.push,
        replace: mocks.replace,
        back: mocks.back,
    }),
}))

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
        mocks.useChatState.messages = []
        mocks.useChatState.status = 'ready'
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
        expect(mocks.setMessages).toHaveBeenCalledWith([])
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

    it('requests the repair draft tool in chat transport', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(mocks.defaultChatTransport).toHaveBeenCalledWith(
            expect.objectContaining({
                body: expect.objectContaining({
                    requestedTools: expect.arrayContaining(['generateRepairRequestDraft']),
                }),
            }),
        )
    })

    it('stores repair drafts and navigates to repair requests when apply is clicked', () => {
        mocks.useChatState.messages = [
            {
                id: 'msg-1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-generateRepairRequestDraft',
                        toolCallId: 'tc-1',
                        toolName: 'generateRepairRequestDraft',
                        state: 'output-available',
                        output: {
                            kind: 'repairRequestDraft',
                            draftOnly: true,
                            source: 'assistant',
                            confidence: 'medium',
                            equipment: { thiet_bi_id: 42 },
                            formData: {
                                thiet_bi_id: 42,
                                mo_ta_su_co: 'Mất nguồn',
                                hang_muc_sua_chua: 'Kiểm tra bo nguồn',
                            },
                            missingFields: [],
                            reviewNotes: [],
                        },
                    },
                ],
            },
        ]

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Dùng bản nháp này' }))

        expect(mocks.setQueryData).toHaveBeenCalledWith(
            ['assistant-draft'],
            expect.objectContaining({ kind: 'repairRequestDraft' }),
        )
        expect(mocks.push).toHaveBeenCalledWith('/repair-requests?action=create')
    })
})
