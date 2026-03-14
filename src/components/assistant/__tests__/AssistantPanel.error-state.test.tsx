import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    sendMessage: vi.fn(),
    stop: vi.fn(),
    setMessages: vi.fn(),
    regenerate: vi.fn(),
    clearError: vi.fn(),
    setQueryData: vi.fn(),
    removeQueries: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    defaultChatTransport: vi.fn(),
    useChatState: {
        messages: [] as Array<Record<string, unknown>>,
        status: 'ready' as string,
        error: null as Error | null,
    },
}))

vi.mock('@ai-sdk/react', () => ({
    useChat: () => ({
        messages: mocks.useChatState.messages,
        status: mocks.useChatState.status,
        error: mocks.useChatState.error,
        sendMessage: mocks.sendMessage,
        stop: mocks.stop,
        setMessages: mocks.setMessages,
        regenerate: mocks.regenerate,
        clearError: mocks.clearError,
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

vi.mock('@/contexts/TenantSelectionContext', () => ({
    useTenantSelection: () => ({
        selectedFacilityId: 1,
        showSelector: false,
        shouldFetchData: true,
    }),
}))

import { AssistantPanel } from '../AssistantPanel'

describe('AssistantPanel error state', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useChatState.messages = []
        mocks.useChatState.status = 'ready'
        mocks.useChatState.error = null
    })

    it('renders error banner when error is present', () => {
        mocks.useChatState.error = new Error('Something went wrong')
        mocks.useChatState.status = 'error'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByTestId('assistant-error-banner')).toBeInTheDocument()
    })

    it('displays the error message text', () => {
        mocks.useChatState.error = new Error('Network connection lost')
        mocks.useChatState.status = 'error'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByText('Network connection lost')).toBeInTheDocument()
    })

    it('parses JSON-wrapped error message and displays clean text', () => {
        mocks.useChatState.error = new Error('{"error":"Facility not selected"}')
        mocks.useChatState.status = 'error'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByText('Facility not selected')).toBeInTheDocument()
        expect(
            screen.queryByText('{"error":"Facility not selected"}'),
        ).not.toBeInTheDocument()
    })

    it('calls regenerate when retry button is clicked', () => {
        mocks.useChatState.error = new Error('Temporary failure')
        mocks.useChatState.status = 'error'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const retryButton = screen.getByRole('button', { name: /thử lại/i })
        fireEvent.click(retryButton)

        expect(mocks.regenerate).toHaveBeenCalledTimes(1)
    })

    it('does not render error banner when error is null', () => {
        mocks.useChatState.error = null
        mocks.useChatState.status = 'ready'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(
            screen.queryByTestId('assistant-error-banner'),
        ).not.toBeInTheDocument()
    })

    it('falls back to generic Vietnamese message when error.message is empty', () => {
        mocks.useChatState.error = new Error('')
        mocks.useChatState.status = 'error'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        expect(
            screen.getByText('Đã xảy ra lỗi. Vui lòng thử lại.'),
        ).toBeInTheDocument()
    })

    it('calls clearError and setMessages when reset button is clicked', () => {
        mocks.useChatState.error = new Error('Test error')
        mocks.useChatState.status = 'error'

        render(<AssistantPanel isOpen={true} onClose={vi.fn()} />)

        const resetButton = screen.getByRole('button', {
            name: /đặt lại cuộc trò chuyện/i,
        })
        fireEvent.click(resetButton)

        expect(mocks.clearError).toHaveBeenCalledTimes(1)
        expect(mocks.setMessages).toHaveBeenCalledWith([])

        // clearError must be called before setMessages
        const clearOrder = mocks.clearError.mock.invocationCallOrder[0]
        const setMsgOrder = mocks.setMessages.mock.invocationCallOrder[0]
        expect(clearOrder).toBeLessThan(setMsgOrder!)
    })
})
