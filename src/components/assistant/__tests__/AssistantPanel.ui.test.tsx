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

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? <div data-testid="assistant-dialog">{children}</div> : null,
    DialogContent: ({
        children,
        className,
        showCloseButton,
        ...props
    }: {
        children: React.ReactNode
        className?: string
        showCloseButton?: boolean
    } & Record<string, unknown>) => (
        <div
            data-testid="assistant-dialog-content"
            className={className}
            data-show-close-button={String(showCloseButton)}
            {...props}
        >
            {children}
        </div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock TenantSelectionContext
vi.mock('@/contexts/TenantSelectionContext', () => ({
    useTenantSelection: () => ({
        selectedFacilityId: 1,
        facilities: [],
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

    it('keeps dialog content above the default overlay layer', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const panel = screen.getByTestId('assistant-panel')
        expect(panel.className).not.toContain('z-[998]')
    })

    it('renders inside a wide dialog shell for chart-friendly layout', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const panel = screen.getByTestId('assistant-panel')
        expect(panel.className).toContain('max-w-4xl')
        expect(panel.className).toContain('h-[90vh]')
    })

    it('suppresses the DialogContent built-in close button to avoid duplicate X controls', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const panel = screen.getByTestId('assistant-panel')
        expect(panel).toHaveAttribute('data-show-close-button', 'false')
    })

    it('requests the repair draft tool in chat transport', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(mocks.defaultChatTransport).toHaveBeenCalledWith(
            expect.objectContaining({
                api: '/api/chat',
            }),
        )

        // body is now a getter function for dynamic resolution
        const transportArgs = mocks.defaultChatTransport.mock.calls[0]?.[0] as {
            body?: unknown
        }
        expect(typeof transportArgs?.body).toBe('function')
        const resolved = (transportArgs.body as () => Record<string, unknown>)()
        expect(resolved.requestedTools).toEqual(
            expect.arrayContaining(['generateRepairRequestDraft']),
        )
    })

    it('applies prepareSendMessagesRequest for payload compaction', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const transportArgs = mocks.defaultChatTransport.mock.calls[0]?.[0] as {
            prepareSendMessagesRequest?: unknown
        }
        expect(typeof transportArgs?.prepareSendMessagesRequest).toBe('function')
    })

    it('preserves transport body fields and compacts envelope tool outputs before send', () => {
        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const transportArgs = mocks.defaultChatTransport.mock.calls[0]?.[0] as {
            body?: () => Record<string, unknown>
            prepareSendMessagesRequest?: (options: {
                id: string
                messages: Array<Record<string, unknown>>
                body?: Record<string, unknown>
                headers?: Record<string, string>
                credentials?: RequestCredentials
                api: string
                requestMetadata?: unknown
                trigger: 'submit-message' | 'regenerate-message'
                messageId?: string
            }) => { body: Record<string, unknown> }
        }

        const baseBody = transportArgs.body?.()
        const requestMessages = [
            {
                id: 'u1',
                role: 'user',
                parts: [{ type: 'text', text: 'Tra cuu thiet bi' }],
            },
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-equipmentLookup',
                        toolCallId: 'tc-1',
                        toolName: 'equipmentLookup',
                        state: 'output-available',
                        output: {
                            modelSummary: {
                                summaryText: 'equipmentLookup: 1 result(s).',
                                itemCount: 1,
                            },
                            followUpContext: {
                                equipment: [{ thiet_bi_id: 42, ten_thiet_bi: 'May tho ABC' }],
                            },
                            uiArtifact: {
                                rawPayload: {
                                    data: [{ thiet_bi_id: 42, ten_thiet_bi: 'May tho ABC' }],
                                    total: 1,
                                },
                            },
                        },
                    },
                ],
            },
        ]

        const prepared = transportArgs.prepareSendMessagesRequest?.({
            id: 'chat-1',
            messages: requestMessages,
            body: baseBody,
            headers: {},
            credentials: 'same-origin',
            api: '/api/chat',
            requestMetadata: undefined,
            trigger: 'submit-message',
            messageId: 'u1',
        })

        expect(prepared?.body.selectedFacilityId).toBe(1)
        expect(prepared?.body.selectedFacilityName).toBeNull()
        expect(prepared?.body.requestedTools).toEqual(
            expect.arrayContaining(['generateRepairRequestDraft']),
        )
        expect(prepared?.body.messages).toEqual([
            requestMessages[0],
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-equipmentLookup',
                        toolCallId: 'tc-1',
                        toolName: 'equipmentLookup',
                        state: 'output-available',
                        output: {
                            modelSummary: {
                                summaryText: 'equipmentLookup: 1 result(s).',
                                itemCount: 1,
                            },
                            followUpContext: {
                                equipment: [{ thiet_bi_id: 42, ten_thiet_bi: 'May tho ABC' }],
                            },
                        },
                    },
                ],
            },
        ])
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
