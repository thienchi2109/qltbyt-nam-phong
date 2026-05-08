/**
 * CSS styles for the Repair Request Sheet (Elegant Dual-Tone Layout).
 * Navy header (#436084) + Gold accents (#C8A951) + Times New Roman.
 */
export const REPAIR_SHEET_STYLES = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 14px;
    color: #436084;
    line-height: 1.4;
    background-color: #f4f3f2;
}

/* ── A4 Page ── */
.a4-page {
    width: 210mm;
    background: #ffffff;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
    margin: 20px auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* ── Header Banner ── */
.header-banner {
    background-color: transparent;
    width: 100%;
    padding: 24px 60px 4px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 20px;
}

.header-logo-container {
    flex-shrink: 0;
}

.header-logo-container img {
    width: 90px;
    height: 90px;
    object-fit: contain;
}

.header-text-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.header-org-name {
    color: #1B3A5C;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
    text-transform: uppercase;
}

.header-title {
    color: #1B3A5C;
    font-weight: 700;
    font-size: 19px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
}

.header-gold-line-bottom {
    width: 100%;
    max-width: 320px;
    height: 1px;
    background: #C8A951;
    opacity: 0.8;
    margin-top: 6px;
}

/* ── Content Body ── */
.content-body {
    flex: 1;
    padding: 16px 60px 40px;
    color: #436084;
}

/* ── Department Field ── */
.dept-row {
    display: flex;
    align-items: flex-end;
    margin-bottom: 24px;
    gap: 10px;
}

.dept-row .dept-label { font-weight: 700; white-space: nowrap; }

.dept-row .dept-value {
    flex: 1;
    border-bottom: 1px solid #C8A951;
    padding-bottom: 3px;
    font-weight: 700;
    font-size: 16px;
    text-align: center;
    text-transform: uppercase;
}

/* ── Section Title ── */
.section-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
}

.section-bullet {
    width: 8px;
    height: 8px;
    background: #436084;
    margin-right: 10px;
    flex-shrink: 0;
}

.section-title {
    font-size: 17px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* ── Dotted Gold Underline ── */
.dotted-gold {
    background-image: linear-gradient(to right, #C8A951 33%, transparent 0%);
    background-position: bottom;
    background-size: 3px 1px;
    background-repeat: repeat-x;
}

/* ── Field with Label + Dotted Value ── */
.field-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-bottom: 20px;
}

.field-row .field-label { font-weight: 700; white-space: nowrap; }

.field-row .field-value {
    flex: 1;
    padding-bottom: 3px;
    font-style: italic;
}

/* ── 2x2 Info Strip ── */
.info-strip {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 10px;
    border-top: 1px solid rgba(200, 169, 81, 0.15);
    border-bottom: 1px solid rgba(200, 169, 81, 0.15);
    padding: 14px 0;
    margin-bottom: 20px;
}

.info-strip .info-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    font-size: 13px;
}

.info-strip .info-cell:nth-child(odd) {
    border-right: 1px solid rgba(27, 58, 92, 0.2);
}

.info-strip .info-cell .info-label {
    font-weight: 700;
    margin-right: 6px;
}

/* ── Text Area Block ── */
.text-block {
    width: 100%;
    background-color: #F0F4F8;
    padding: 14px 16px;
    min-height: 56px;
    font-style: italic;
    border-left: 2px solid rgba(27, 58, 92, 0.3);
    margin-bottom: 20px;
}

/* ── Completion Date ── */
.completion-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.completion-row .completion-label { font-weight: 700; white-space: nowrap; }

.completion-row .completion-value {
    width: 160px;
    padding-bottom: 3px;
    display: flex;
    align-items: flex-end;
    padding-left: 8px;
}

.date-input {
    background: transparent;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    color: inherit;
    font-style: italic;
    width: 100%;
    cursor: pointer;
}

/* ── Date Line ── */
.date-line {
    text-align: right;
    font-style: italic;
    margin-bottom: 28px;
    font-size: 14px;
}

/* ── Signature ── */
.signature-layout {
    display: flex;
    flex-direction: column;
    gap: 28px;
}

.signature-row {
    display: grid;
    text-align: center;
    margin-top: 0;
}

.signature-row-top {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}

.signature-row-bottom {
    grid-template-columns: 1fr;
    justify-items: center;
}

.signature-col {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.sig-title {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 13px;
    margin-bottom: 16px;
}

.sig-space {
    height: 56px;
}

.sig-line {
    width: 120px;
    height: 1px;
    background: rgba(27, 58, 92, 0.1);
}

.sig-name { font-weight: 700; font-size: 14px; color: #436084; }

/* ── Print ── */
@media print {
    body {
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    .a4-page {
        width: 210mm !important;
        margin: 0 !important;
        box-shadow: none !important;
    }
    .no-print { display: none !important; }
    .a4-page + .a4-page { margin-top: 0 !important; }
    .date-input::-webkit-calendar-picker-indicator { display: none !important; }
}
`
