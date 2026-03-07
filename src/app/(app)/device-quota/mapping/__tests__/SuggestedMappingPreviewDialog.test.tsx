import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ============================================
// Polyfills for jsdom
// ============================================

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    })
})

// ============================================
// Mocks
// ============================================

const mockUseSuggestMapping = vi.fn()
vi.mock('../_hooks/useSuggestMapping', () => ({
    useSuggestMapping: (...args: unknown[]) => mockUseSuggestMapping(...args),
}))

import type { SuggestMappingResult, SuggestMappingStatus, SuggestedGroup } from '../_hooks/useSuggestMapping'
import { SuggestedMappingGroupSection } from '../_components/SuggestedMappingGroupSection'
import { SuggestedMappingUnmatchedSection } from '../_components/SuggestedMappingUnmatchedSection'
import { SuggestedMappingPreviewDialog } from '../_components/SuggestedMappingPreviewDialog'

// ============================================
// Fixtures
// ============================================

const GROUP_A: SuggestedGroup = {
    nhom_id: 10,
    nhom_label: 'Máy thở chức năng cao',
    nhom_code: 'A.01',
    phan_loai: 'Loại B',
    rrf_score: 0.95,
    device_names: ['Máy thở Drager', 'Máy thở Hamilton'],
    device_ids: [1, 2, 3, 4, 5],
}

const GROUP_B: SuggestedGroup = {
    nhom_id: 20,
    nhom_label: 'Bơm tiêm điện tự động',
    nhom_code: 'B.02',
    phan_loai: 'Loại C',
    rrf_score: 0.88,
    device_names: ['Bơm tiêm điện'],
    device_ids: [6, 7],
}

const UNMATCHED = [
    { device_name: 'Máy X-quang cũ', device_ids: [8] },
    { device_name: 'Thiết bị không rõ', device_ids: [9, 10] },
]

const DONE_RESULT: SuggestMappingResult = {
    groups: [GROUP_A, GROUP_B],
    unmatched: UNMATCHED,
    totalDevices: 10,
    matchedDevices: 7,
}

function setupHook(overrides: {
    status?: SuggestMappingStatus
    result?: SuggestMappingResult | null
    error?: string | null
    progress?: number
} = {}) {
    const reset = vi.fn()
    mockUseSuggestMapping.mockReturnValue({
        status: 'done',
        result: DONE_RESULT,
        error: null,
        progress: 100,
        reset,
        ...overrides,
    })
    return { reset }
}

// ============================================
// Step 4: SuggestedMappingGroupSection
// ============================================

describe('SuggestedMappingGroupSection', () => {
    it('renders group header with category name, code badge, and device count', () => {
        render(
            <SuggestedMappingGroupSection
                group={GROUP_A}
                excludedDeviceNames={new Set()}
                isGroupExcluded={false}
                onToggleDeviceName={() => { }}
                onToggleGroup={() => { }}
            />
        )

        expect(screen.getByText('Máy thở chức năng cao')).toBeInTheDocument()
        expect(screen.getByText('A.01')).toBeInTheDocument()
        expect(screen.getByText(/5 thiết bị/)).toBeInTheDocument()
    })

    it('renders device names within group', () => {
        render(
            <SuggestedMappingGroupSection
                group={GROUP_A}
                excludedDeviceNames={new Set()}
                isGroupExcluded={false}
                onToggleDeviceName={() => { }}
                onToggleGroup={() => { }}
            />
        )

        expect(screen.getByText('Máy thở Drager')).toBeInTheDocument()
        expect(screen.getByText('Máy thở Hamilton')).toBeInTheDocument()
    })

    it('calls onToggleDeviceName when exclude button is clicked on a device name', () => {
        const onToggle = vi.fn()
        render(
            <SuggestedMappingGroupSection
                group={GROUP_A}
                excludedDeviceNames={new Set()}
                isGroupExcluded={false}
                onToggleDeviceName={onToggle}
                onToggleGroup={() => { }}
            />
        )

        // Use exact match to skip the group-level "Loại bỏ nhóm" button
        const removeButtons = screen.getAllByRole('button', { name: 'Loại bỏ' })
        fireEvent.click(removeButtons[0])
        expect(onToggle).toHaveBeenCalledWith('Máy thở Drager')
    })

    it('shows excluded state for specific device names', () => {
        render(
            <SuggestedMappingGroupSection
                group={GROUP_A}
                excludedDeviceNames={new Set(['Máy thở Drager'])}
                isGroupExcluded={false}
                onToggleDeviceName={() => { }}
                onToggleGroup={() => { }}
            />
        )

        const drager = screen.getByText('Máy thở Drager')
        expect(drager).toHaveClass('line-through')
        expect(screen.getByText('Máy thở Hamilton')).not.toHaveClass('line-through')
    })

    it('calls onToggleGroup when group toggle button is clicked', () => {
        const onToggleGroup = vi.fn()
        render(
            <SuggestedMappingGroupSection
                group={GROUP_A}
                excludedDeviceNames={new Set()}
                isGroupExcluded={false}
                onToggleDeviceName={() => { }}
                onToggleGroup={onToggleGroup}
            />
        )

        const groupBtn = screen.getByRole('button', { name: /loại bỏ nhóm/i })
        fireEvent.click(groupBtn)
        expect(onToggleGroup).toHaveBeenCalledTimes(1)
    })

    it('shows restore group button when group is excluded', () => {
        render(
            <SuggestedMappingGroupSection
                group={GROUP_A}
                excludedDeviceNames={new Set()}
                isGroupExcluded={true}
                onToggleDeviceName={() => { }}
                onToggleGroup={() => { }}
            />
        )

        expect(screen.getByRole('button', { name: /khôi phục nhóm/i })).toBeInTheDocument()
    })
})

// ============================================
// Step 5: SuggestedMappingUnmatchedSection
// ============================================

describe('SuggestedMappingUnmatchedSection', () => {
    it('renders header with unmatched count', () => {
        render(<SuggestedMappingUnmatchedSection unmatched={UNMATCHED} />)

        expect(screen.getByText(/chưa gợi ý được/i)).toBeInTheDocument()
        expect(screen.getByText(/3 thiết bị/)).toBeInTheDocument()
    })

    it('shows device names when expanded', () => {
        render(<SuggestedMappingUnmatchedSection unmatched={UNMATCHED} />)

        // Expand the collapsible
        const trigger = screen.getByRole('button', { name: /chưa gợi ý được/i })
        fireEvent.click(trigger)

        expect(screen.getByText('Máy X-quang cũ')).toBeInTheDocument()
        expect(screen.getByText('Thiết bị không rõ')).toBeInTheDocument()
    })

    it('does not render when unmatched is empty', () => {
        const { container } = render(
            <SuggestedMappingUnmatchedSection unmatched={[]} />
        )

        expect(container.firstChild).toBeNull()
    })
})

// ============================================
// Step 6: SuggestedMappingPreviewDialog
// ============================================

describe('SuggestedMappingPreviewDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows loading progress during pipeline', () => {
        setupHook({ status: 'embedding', result: null, progress: 33 })

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        expect(screen.getByText(/đang tạo embedding/i)).toBeInTheDocument()
    })

    it('renders grouped suggestions after pipeline completes', () => {
        setupHook()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        expect(screen.getByText('Máy thở chức năng cao')).toBeInTheDocument()
        expect(screen.getByText('Bơm tiêm điện tự động')).toBeInTheDocument()
    })

    it('renders footer disclaimer always visible', () => {
        setupHook()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        expect(
            screen.getByText(/đây chỉ là gợi ý phân loại/i)
        ).toBeInTheDocument()
    })

    it('hides confirm button for regional_leader', () => {
        setupHook()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="regional_leader"
            />
        )

        expect(screen.queryByRole('button', { name: /áp dụng/i })).not.toBeInTheDocument()
    })

    it('shows disabled confirm button with group count for write-capable role', () => {
        setupHook()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        const confirmBtn = screen.getByRole('button', { name: /áp dụng 2 gợi ý/i })
        expect(confirmBtn).toBeDisabled()
    })

    it('shows summary count badge with matched/total devices', () => {
        setupHook()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        expect(screen.getByText(/7.*\/.*10/)).toBeInTheDocument()
    })

    it('renders unmatched section when there are unmatched devices', () => {
        setupHook()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        expect(screen.getByText(/chưa gợi ý được/i)).toBeInTheDocument()
    })

    it('shows error state when pipeline fails', () => {
        setupHook({ status: 'error', result: null, error: 'Network error' })

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={() => { }}
                donViId={1}
                userRole="admin"
            />
        )

        expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    it('calls reset and onOpenChange when dialog is closed', () => {
        const { reset } = setupHook()
        const onOpenChange = vi.fn()

        render(
            <SuggestedMappingPreviewDialog
                open={true}
                onOpenChange={onOpenChange}
                donViId={1}
                userRole="admin"
            />
        )

        const cancelBtn = screen.getByRole('button', { name: /đóng/i })
        fireEvent.click(cancelBtn)

        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(reset).toHaveBeenCalled()
    })
})
