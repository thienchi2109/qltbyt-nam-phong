import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantEmptyState } from '../AssistantEmptyState'

describe('AssistantEmptyState', () => {
    it('renders welcome message', () => {
        render(<AssistantEmptyState onSuggestionClick={vi.fn()} isReady={true} />)

        expect(screen.getByText(/xin chào/i)).toBeInTheDocument()
    })

    it('renders the Sparkles icon', () => {
        render(<AssistantEmptyState onSuggestionClick={vi.fn()} isReady={true} />)

        expect(screen.getByTestId('assistant-empty-icon')).toBeInTheDocument()
    })

    it('renders suggested questions', () => {
        render(<AssistantEmptyState onSuggestionClick={vi.fn()} isReady={true} />)

        // Should render exactly 3 suggestion chips
        const chips = screen.getAllByRole('button')
        expect(chips.length).toBe(3)
    })
})
