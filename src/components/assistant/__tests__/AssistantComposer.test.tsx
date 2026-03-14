import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantComposer } from '../AssistantComposer'

describe('AssistantComposer', () => {
    const defaultProps = {
        input: '',
        onInputChange: vi.fn(),
        onSend: vi.fn(),
        onStop: vi.fn(),
        isStreaming: false,
        isReady: true,
    }

    const PLACEHOLDER = 'Hỏi AI về thiết bị, bảo trì...'

    it('renders textarea with the batch 3 placeholder', () => {
        render(<AssistantComposer {...defaultProps} />)

        expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
    })

    it('calls onInputChange when typing', () => {
        const onInputChange = vi.fn()
        render(<AssistantComposer {...defaultProps} onInputChange={onInputChange} />)

        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
            target: { value: 'Xin chào' },
        })
        expect(onInputChange).toHaveBeenCalledWith('Xin chào')
    })

    it('hides send button when input is empty and shows it when input has content', () => {
        const { rerender } = render(<AssistantComposer {...defaultProps} input="" />)
        expect(screen.queryByLabelText('Gửi')).not.toBeInTheDocument()

        rerender(<AssistantComposer {...defaultProps} input="Xin chào" />)
        expect(screen.getByLabelText('Gửi')).toBeInTheDocument()
    })

    it('disables composer when not ready', () => {
        render(<AssistantComposer {...defaultProps} input="Xin chào" isReady={false} />)

        expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDisabled()
        expect(screen.getByLabelText('Gửi')).toBeDisabled()
    })

    it('calls onSend on send button click', () => {
        const onSend = vi.fn()
        render(<AssistantComposer {...defaultProps} input="Xin chào" onSend={onSend} />)

        fireEvent.click(screen.getByLabelText('Gửi'))
        expect(onSend).toHaveBeenCalledOnce()
    })

    it('calls onSend on Enter key (without Shift)', () => {
        const onSend = vi.fn()
        render(<AssistantComposer {...defaultProps} input="Xin chào" onSend={onSend} />)

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), {
            key: 'Enter',
            shiftKey: false,
        })
        expect(onSend).toHaveBeenCalledOnce()
    })

    it('does NOT call onSend on Shift+Enter', () => {
        const onSend = vi.fn()
        render(<AssistantComposer {...defaultProps} input="Xin chào" onSend={onSend} />)

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), {
            key: 'Enter',
            shiftKey: true,
        })
        expect(onSend).not.toHaveBeenCalled()
    })

    it('shows stop button during streaming', () => {
        render(<AssistantComposer {...defaultProps} isStreaming={true} />)

        expect(screen.getByLabelText('Dừng')).toBeInTheDocument()
        expect(screen.queryByLabelText('Gửi')).not.toBeInTheDocument()
    })

    it('calls onStop when stop button is clicked', () => {
        const onStop = vi.fn()
        render(<AssistantComposer {...defaultProps} isStreaming={true} onStop={onStop} />)

        fireEvent.click(screen.getByLabelText('Dừng'))
        expect(onStop).toHaveBeenCalledOnce()
    })

    it('disables textarea when streaming', () => {
        render(<AssistantComposer {...defaultProps} isStreaming={true} />)

        expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDisabled()
    })
})
