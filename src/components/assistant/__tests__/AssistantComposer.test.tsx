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

    it('renders textarea with placeholder', () => {
        render(<AssistantComposer {...defaultProps} />)

        expect(screen.getByPlaceholderText('Hỏi trợ lý...')).toBeInTheDocument()
    })

    it('calls onInputChange when typing', () => {
        const onInputChange = vi.fn()
        render(<AssistantComposer {...defaultProps} onInputChange={onInputChange} />)

        fireEvent.change(screen.getByPlaceholderText('Hỏi trợ lý...'), {
            target: { value: 'Xin chào' },
        })
        expect(onInputChange).toHaveBeenCalledWith('Xin chào')
    })

    it('shows send button only when input has content', () => {
        const { rerender } = render(<AssistantComposer {...defaultProps} input="" />)
        expect(screen.getByLabelText('Gửi')).toBeDisabled()

        rerender(<AssistantComposer {...defaultProps} input="Xin chào" />)
        expect(screen.getByLabelText('Gửi')).not.toBeDisabled()
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

        fireEvent.keyDown(screen.getByPlaceholderText('Hỏi trợ lý...'), {
            key: 'Enter',
            shiftKey: false,
        })
        expect(onSend).toHaveBeenCalledOnce()
    })

    it('does NOT call onSend on Shift+Enter', () => {
        const onSend = vi.fn()
        render(<AssistantComposer {...defaultProps} input="Xin chào" onSend={onSend} />)

        fireEvent.keyDown(screen.getByPlaceholderText('Hỏi trợ lý...'), {
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

        expect(screen.getByPlaceholderText('Hỏi trợ lý...')).toBeDisabled()
    })
})
