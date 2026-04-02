/**
 * CSS styles for the Repair Request Sheet (Structured Grid Layout).
 * Extracted from request-sheet.ts for maintainability.
 */
export const REPAIR_SHEET_STYLES = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 14px;
    color: #2d3335;
    line-height: 1.4;
    background-color: #d4dbdd;
}

/* ── A4 Page Container ── */
.a4-page {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm 20mm;
    margin: 20px auto;
    background: #ffffff;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    position: relative;
}

.page-break { page-break-before: always; }

/* ── Grid Table System ── */
.grid-border { border: 1px solid #000; }
.grid-border-t { border-top: 1px solid #000; }
.grid-border-b { border-bottom: 1px solid #000; }
.grid-border-l { border-left: 1px solid #000; }
.grid-border-r { border-right: 1px solid #000; }

.grid-row {
    display: grid;
    width: 100%;
}

.grid-row-2col { grid-template-columns: 200px 1fr; }
.grid-row-6col { grid-template-columns: 100px 1fr 100px 1fr 100px 1fr; }
.grid-row-header { grid-template-columns: 100px 1fr 150px; }
.grid-row-dept { grid-template-columns: 30% 70%; }

/* ── Cell Styles ── */
.cell {
    padding: 8px 10px;
    font-size: 14px;
    display: flex;
    align-items: center;
}

.cell-label {
    background-color: #ebeeef;
    font-weight: 700;
    font-size: 14px;
    border-right: 1px solid #000;
}

.cell-value {
    background-color: #fff;
    font-size: 14px;
}

.cell-border-b { border-bottom: 1px solid #000; }
.cell-border-r { border-right: 1px solid #000; }

.cell-tall { min-height: 56px; }

/* ── Typography ── */
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: 700; }
.italic { font-style: italic; }
.uppercase { text-transform: uppercase; }
.tracking-wide { letter-spacing: 0.08em; }

.title-org { font-size: 16px; font-weight: 700; line-height: 1.3; }
.title-main { font-size: 20px; font-weight: 700; letter-spacing: 0.05em; margin-top: 6px; white-space: nowrap; }
.section-title {
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    color: #3a5f94;
    padding: 8px 10px;
}
.section-title-dark {
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    color: #2d3335;
    padding: 8px 10px;
}

/* ── Checkbox ── */
.checkbox-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1px solid #000;
    font-weight: 700;
    font-size: 12px;
    margin-right: 6px;
    flex-shrink: 0;
}

.checkbox-group {
    display: flex;
    align-items: center;
    gap: 32px;
}

.checkbox-label {
    display: flex;
    align-items: center;
}

/* ── Signature ── */
.signature-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    text-align: center;
    margin-top: 32px;
}

.signature-col {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.signature-space { height: 80px; }
.signature-name { font-weight: 700; font-size: 14px; }
.signature-subtitle { font-style: italic; font-size: 12px; color: #5a6061; }

/* ── Date Line ── */
.date-line {
    text-align: right;
    font-style: italic;
    margin-bottom: 16px;
    font-size: 14px;
}

/* ── Textarea (Page 2) ── */
.result-textarea {
    width: 100%;
    min-height: 120px;
    border: 1px solid #000;
    padding: 10px;
    font-family: inherit;
    font-size: 14px;
    resize: none;
    outline: none;
    background: #fff;
}

/* ── Utility ── */
.mb-neg { margin-bottom: -1px; }
.mt-8 { margin-top: 32px; }
.mt-6 { margin-top: 24px; }
.mb-6 { margin-bottom: 24px; }

/* ── Logo ── */
.logo-img {
    width: 70px;
    height: 70px;
    object-fit: contain;
}

/* ── Print Styles ── */
@media print {
    body {
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    .a4-page {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        padding: 15mm 20mm !important;
        box-shadow: none !important;
    }
    .page-break { page-break-before: always !important; }
    .no-print { display: none !important; }
}
`
