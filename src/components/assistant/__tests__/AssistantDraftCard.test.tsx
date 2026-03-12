import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RepairRequestDraft } from '@/lib/ai/draft/repair-request-draft-schema'
import type { TroubleshootingDraft } from '@/lib/ai/draft/troubleshooting-schema'

import { AssistantDraftCard } from '../AssistantDraftCard'

const REPAIR_DRAFT: RepairRequestDraft = {
    kind: 'repairRequestDraft',
    draftOnly: true,
    source: 'assistant',
    confidence: 'medium',
    equipment: {
        thiet_bi_id: 42,
        ma_thiet_bi: 'TB-042',
        ten_thiet_bi: 'Máy siêu âm A',
    },
    formData: {
        thiet_bi_id: 42,
        mo_ta_su_co: 'Màn hình bị nhiễu',
        hang_muc_sua_chua: 'Thay thế màn hình',
        ngay_mong_muon_hoan_thanh: '2026-04-01',
        don_vi_thuc_hien: 'noi_bo',
        ten_don_vi_thue: null,
    },
    missingFields: ['Người phụ trách'],
    reviewNotes: ['Kiểm tra lại model trước khi gửi'],
}

const TROUBLESHOOTING_DRAFT: TroubleshootingDraft = {
    kind: 'troubleshootingDraft',
    draftOnly: true,
    basedOnEvidence: true,
    evidenceRefs: ['equipmentLookup', 'repairSummary'],
    equipment_context: {
        thiet_bi_id: 42,
        ma_thiet_bi: 'TB-042',
        ten_thiet_bi: 'Máy siêu âm A',
        model: 'Model X',
        khoa_phong: 'Khoa Nội',
        tinh_trang_hien_tai: 'Hỏng',
    },
    probable_causes: [
        {
            label: 'Cáp tín hiệu bị đứt',
            confidence: 'high',
            rationale: 'Hiện tượng nhiễu màn hình thường do cáp tín hiệu',
        },
    ],
    remediation_steps: [
        {
            step: 'Kiểm tra cáp kết nối giữa bo mạch và màn hình',
            type: 'inspection',
        },
    ],
    limitations: ['Chưa có hình ảnh lỗi thực tế'],
}

describe('AssistantDraftCard', () => {
    describe('repairRequestDraft', () => {
        it('renders "BẢN NHÁP" badge', () => {
            render(
                <AssistantDraftCard draft={REPAIR_DRAFT} onApplyDraft={vi.fn()} />,
            )

            expect(screen.getByText('BẢN NHÁP')).toBeInTheDocument()
        })

        it('renders structured form fields from draft data', () => {
            render(
                <AssistantDraftCard draft={REPAIR_DRAFT} onApplyDraft={vi.fn()} />,
            )

            expect(screen.getByText(/Máy siêu âm A/)).toBeInTheDocument()
            expect(screen.getByText(/Màn hình bị nhiễu/)).toBeInTheDocument()
            expect(screen.getByText(/Thay thế màn hình/)).toBeInTheDocument()
        })

        it('renders CTA button "Dùng bản nháp này"', () => {
            render(
                <AssistantDraftCard draft={REPAIR_DRAFT} onApplyDraft={vi.fn()} />,
            )

            expect(
                screen.getByRole('button', { name: /Dùng bản nháp này/ }),
            ).toBeInTheDocument()
        })

        it('calls onApplyDraft with draft payload when CTA is clicked', () => {
            const onApplyDraft = vi.fn()
            render(
                <AssistantDraftCard
                    draft={REPAIR_DRAFT}
                    onApplyDraft={onApplyDraft}
                />,
            )

            fireEvent.click(
                screen.getByRole('button', { name: /Dùng bản nháp này/ }),
            )
            expect(onApplyDraft).toHaveBeenCalledWith(REPAIR_DRAFT)
        })

        it('renders disclaimer text about draft not being submitted', () => {
            render(
                <AssistantDraftCard draft={REPAIR_DRAFT} onApplyDraft={vi.fn()} />,
            )

            expect(screen.getByText(/chưa được gửi/i)).toBeInTheDocument()
        })

        it('renders review notes when present', () => {
            render(
                <AssistantDraftCard draft={REPAIR_DRAFT} onApplyDraft={vi.fn()} />,
            )

            expect(
                screen.getByText(/Kiểm tra lại model trước khi gửi/),
            ).toBeInTheDocument()
        })
    })

    describe('troubleshootingDraft', () => {
        it('renders probable causes', () => {
            render(
                <AssistantDraftCard
                    draft={TROUBLESHOOTING_DRAFT}
                    onApplyDraft={vi.fn()}
                />,
            )

            expect(screen.getByText(/Cáp tín hiệu bị đứt/)).toBeInTheDocument()
        })

        it('renders remediation steps', () => {
            render(
                <AssistantDraftCard
                    draft={TROUBLESHOOTING_DRAFT}
                    onApplyDraft={vi.fn()}
                />,
            )

            expect(
                screen.getByText(/Kiểm tra cáp kết nối/),
            ).toBeInTheDocument()
        })

        it('does NOT render repair CTA button', () => {
            render(
                <AssistantDraftCard
                    draft={TROUBLESHOOTING_DRAFT}
                    onApplyDraft={vi.fn()}
                />,
            )

            expect(
                screen.queryByRole('button', { name: /Dùng bản nháp này/ }),
            ).not.toBeInTheDocument()
        })

        it('renders evidence-based advisory label', () => {
            render(
                <AssistantDraftCard
                    draft={TROUBLESHOOTING_DRAFT}
                    onApplyDraft={vi.fn()}
                />,
            )

            expect(
                screen.getByText(/Khuyến nghị chẩn đoán/),
            ).toBeInTheDocument()
        })
    })
})
