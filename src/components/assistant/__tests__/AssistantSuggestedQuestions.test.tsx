import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantSuggestedQuestions } from '../AssistantSuggestedQuestions'
import { STARTER_PROMPT_GROUPS } from '@/lib/ai/prompts/starter-suggestions'

/** Flatten all suggestion strings from groups for membership checks. */
const ALL_SUGGESTIONS = STARTER_PROMPT_GROUPS.flatMap((g) => g.suggestions)

describe('AssistantSuggestedQuestions', () => {
    it('renders exactly 3 suggestion chips after mount', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        expect(chips).toHaveLength(3)
    })

    it('each chip text comes from the suggestion pool', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        chips.forEach((chip) => {
            expect(ALL_SUGGESTIONS).toContain(chip.textContent?.trim())
        })
    })

    it('calls onSelect with the chip text when clicked', async () => {
        const onSelect = vi.fn()
        render(<AssistantSuggestedQuestions onSelect={onSelect} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        fireEvent.click(chips[0])
        expect(onSelect).toHaveBeenCalledWith(expect.any(String))
        expect(ALL_SUGGESTIONS).toContain(onSelect.mock.calls[0][0])
    })

    it('disables chips when isReady is false', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={false} />)

        const chips = await screen.findAllByRole('button')
        chips.forEach((chip) => {
            expect(chip).toBeDisabled()
        })
    })

    it('each chip has the stagger animation class', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        chips.forEach((chip) => {
            expect(chip.className).toContain('assistant-chip-enter')
        })
    })
})
