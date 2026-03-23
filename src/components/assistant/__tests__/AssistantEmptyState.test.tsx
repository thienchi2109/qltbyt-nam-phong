import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantEmptyState } from '../AssistantEmptyState'

describe('AssistantEmptyState', () => {
    it('renders the Phase 4 empty-state copy', () => {
        render(<AssistantEmptyState onSuggestionClick={vi.fn()} isReady={true} />)

        expect(screen.getByText('Xin chào! Tôi có thể giúp gì cho bạn hôm nay?')).toBeInTheDocument()
    })

    it('renders the Sparkles icon', () => {
        render(<AssistantEmptyState onSuggestionClick={vi.fn()} isReady={true} />)

        expect(screen.getByTestId('assistant-empty-icon')).toBeInTheDocument()
    })

    it('renders suggested questions after mount', async () => {
        render(<AssistantEmptyState onSuggestionClick={vi.fn()} isReady={true} />)

        // Chips populate via useEffect, so use async find
        const chips = await screen.findAllByRole('button')
        expect(chips.length).toBe(5)
    })
})
