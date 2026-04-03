import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantSuggestedQuestions } from '../AssistantSuggestedQuestions'
import { STARTER_PROMPT_GROUPS, PINNED_PROMPTS } from '@/lib/ai/prompts/starter-suggestions'

/** Flatten all suggestion strings from groups for membership checks. */
const ALL_RANDOM_SUGGESTIONS = STARTER_PROMPT_GROUPS.flatMap((g) => g.suggestions)

describe('AssistantSuggestedQuestions', () => {
    it('does not expose placeholder equipment starter prompts that encourage ambiguous lookups', () => {
        expect(ALL_RANDOM_SUGGESTIONS).not.toContain('Tra cứu thông tin thiết bị X')
        expect(ALL_RANDOM_SUGGESTIONS).not.toContain('Lịch bảo trì, hiệu chuẩn năm nay của thiết bị X')
        expect(ALL_RANDOM_SUGGESTIONS).not.toContain('Lịch sử sử dụng thiết bị X')
        expect(ALL_RANDOM_SUGGESTIONS).not.toContain('Tài liệu đính kèm của thiết bị X')
    })

    it('renders exactly 5 chips: 2 pinned + 3 random', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        expect(chips).toHaveLength(5)
    })

    it('first 2 chips are the pinned prompts in order', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        expect(chips[0].textContent?.trim()).toBe(PINNED_PROMPTS[0])
        expect(chips[1].textContent?.trim()).toBe(PINNED_PROMPTS[1])
    })

    it('last 3 chips come from the random suggestion pool', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        const randomChips = chips.slice(2)
        randomChips.forEach((chip) => {
            expect(ALL_RANDOM_SUGGESTIONS).toContain(chip.textContent?.trim())
        })
    })

    it('random chips do not duplicate any pinned prompt', async () => {
        render(<AssistantSuggestedQuestions onSelect={vi.fn()} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        const randomTexts = chips.slice(2).map((c) => c.textContent?.trim())
        for (const pinned of PINNED_PROMPTS) {
            expect(randomTexts).not.toContain(pinned)
        }
    })

    it('calls onSelect with the chip text when clicked', async () => {
        const onSelect = vi.fn()
        render(<AssistantSuggestedQuestions onSelect={onSelect} isReady={true} />)

        const chips = await screen.findAllByRole('button')
        fireEvent.click(chips[0])
        expect(onSelect).toHaveBeenCalledWith(PINNED_PROMPTS[0])
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
