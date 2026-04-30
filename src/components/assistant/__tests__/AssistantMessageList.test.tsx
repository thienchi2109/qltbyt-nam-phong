import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ai', () => ({
    isToolUIPart: (part: { type: string }) => part.type.startsWith('tool-'),
    getToolName: (part: { type: string }) => part.type.replace('tool-', ''),
}))

vi.mock('../AssistantReportChartCard', () => ({
    AssistantReportChartCard: ({ artifact }: { artifact: { title?: string } }) => (
        <div data-testid="assistant-report-chart-card">{artifact.title ?? 'chart'}</div>
    ),
}))

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

import { AssistantMessageList } from '../AssistantMessageList'

/** Helper to build a minimal UIMessage-like object. */
function makeMessage(
    role: 'user' | 'assistant',
    parts: Array<Record<string, unknown>>,
    id = 'msg-1',
) {
    return { id, role, parts, createdAt: new Date() }
}

describe('AssistantMessageList', () => {
    beforeEach(() => {
        consoleErrorSpy.mockClear()
    })

    it('renders user text messages right-aligned', () => {
        const messages = [
            makeMessage('user', [{ type: 'text', text: 'Xin chào!' }]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByText('Xin chào!')).toBeInTheDocument()
        // User bubble should be identifiable
        const bubble = screen.getByText('Xin chào!').closest('[data-role="user"]')
        expect(bubble).toBeInTheDocument()
    })

    it('renders AI text messages with markdown', () => {
        const messages = [
            makeMessage('assistant', [
                { type: 'text', text: 'Thiết bị **TB-042** đang hoạt động bình thường.' },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByText(/TB-042/)).toBeInTheDocument()
    })

    it('renders tool execution cards for tool parts', () => {
        const messages = [
            makeMessage('assistant', [
                {
                    type: 'tool-equipmentLookup',
                    toolCallId: 'tc-1',
                    toolName: 'equipmentLookup',
                    state: 'output-available',
                    input: { query: 'Máy siêu âm' },
                    output: { items: [] },
                },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByTestId('tool-execution-card')).toBeInTheDocument()
    })

    it('renders an inline chart card for reportChart artifacts', () => {
        const messages = [
            makeMessage('assistant', [
                {
                    type: 'tool-query_database',
                    toolCallId: 'tc-chart',
                    toolName: 'query_database',
                    state: 'output-available',
                    output: {
                        modelSummary: {
                            summaryText: 'Đã tổng hợp số lượng thiết bị theo khoa.',
                            itemCount: 2,
                        },
                        uiArtifact: {
                            rawPayload: {
                                kind: 'reportChart',
                                version: 1,
                                title: 'Số lượng thiết bị theo khoa',
                                chart: {
                                    type: 'bar',
                                    xKey: 'khoa_phong_quan_ly',
                                    yKey: 'so_luong',
                                    data: [
                                        { khoa_phong_quan_ly: 'ICU', so_luong: 12 },
                                        { khoa_phong_quan_ly: 'Xét nghiệm', so_luong: 7 },
                                    ],
                                },
                            },
                        },
                    },
                },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByTestId('assistant-report-chart-card')).toBeInTheDocument()
        expect(screen.getByText('Số lượng thiết bị theo khoa')).toBeInTheDocument()
    })

    it('renders tool execution card with spinner for executing state', () => {
        const messages = [
            makeMessage('assistant', [
                {
                    type: 'tool-equipmentLookup',
                    toolCallId: 'tc-1',
                    toolName: 'equipmentLookup',
                    state: 'input-available',
                },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="streaming"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByTestId('tool-executing-spinner')).toBeInTheDocument()
    })

    it('renders tool execution card with checkmark for completed state', () => {
        const messages = [
            makeMessage('assistant', [
                {
                    type: 'tool-equipmentLookup',
                    toolCallId: 'tc-1',
                    toolName: 'equipmentLookup',
                    state: 'output-available',
                    input: { query: 'test' },
                    output: { items: [] },
                },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByTestId('tool-completed-check')).toBeInTheDocument()
    })

    it('detects repairRequestDraft in tool output and renders draft card', () => {
        const messages = [
            makeMessage('assistant', [
                {
                    type: 'tool-generateRepairRequestDraft',
                    toolCallId: 'tc-2',
                    toolName: 'generateRepairRequestDraft',
                    state: 'output-available',
                    input: {},
                    output: {
                        kind: 'repairRequestDraft',
                        draftOnly: true,
                        source: 'assistant',
                        confidence: 'medium',
                        equipment: { thiet_bi_id: 42 },
                        formData: {
                            mo_ta_su_co: 'Lỗi màn hình',
                            hang_muc_sua_chua: 'Thay màn hình',
                        },
                    },
                },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByText('BẢN NHÁP')).toBeInTheDocument()
    })

    it('shows thinking indicator when streaming with no text parts', () => {
        const messages = [
            makeMessage('assistant', [], 'msg-streaming'),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="streaming"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByTestId('assistant-thinking-container')).toBeInTheDocument()
    })

    it('shows thinking indicator when status is submitted', () => {
        const messages = [
            makeMessage('user', [{ type: 'text', text: 'Xin chào' }]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="submitted"
                onApplyDraft={vi.fn()}
            />,
        )

        expect(screen.getByTestId('assistant-thinking-container')).toBeInTheDocument()
    })

    it('uses unique fallback keys for repeated non-text non-tool part types', () => {
        const messages = [
            makeMessage('assistant', [
                { type: 'source', sourceId: 's1' },
                { type: 'source', sourceId: 's2' },
            ]),
        ]

        render(
            <AssistantMessageList
                messages={messages as never}
                status="ready"
                onApplyDraft={vi.fn()}
            />,
        )

        const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter(([message]) =>
            typeof message === 'string' && message.includes('Encountered two children with the same key'),
        )

        expect(duplicateKeyWarnings).toHaveLength(0)
    })
})
