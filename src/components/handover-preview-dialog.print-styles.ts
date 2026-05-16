export const HANDOVER_PRINT_STYLES = `
body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 13px;
    color: #000;
    background-color: #e5e7eb;
    line-height: 1.4;
    margin: 0;
    padding: 0;
}

.a4-landscape-page {
    width: 29.7cm;
    min-height: 21cm;
    padding: 1cm 2cm 1cm 1cm;
    margin: 1cm auto;
    background: white;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    position: relative;
    display: flex;
    flex-direction: column;
}

.content-body { flex-grow: 1; }
.form-input-line {
    font-family: inherit;
    font-size: inherit;
    border: none;
    border-bottom: 1px dotted #000;
    background-color: transparent;
    padding: 2px 1px;
    outline: none;
    width: 100%;
    min-height: 1.1em;
}
.form-input-readonly { border-bottom: 1px solid #000; font-weight: 500; }
.editable-cell {
    border-bottom: 1px solid #ccc !important;
    background-color: #f9f9f9;
    cursor: text;
    min-height: 18px;
    padding: 3px 4px !important;
}
.editable-cell:focus {
    background-color: #fff;
    border-bottom: 1px solid #007bff !important;
    outline: none;
}
.editable-cell:empty:before {
    content: attr(data-placeholder);
    color: #999;
    font-style: italic;
}
.font-bold { font-weight: 700; }
.title-main { font-size: 20px; }
.title-sub { font-size: 16px; }
.text-center { text-align: center; }
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }
.whitespace-nowrap { white-space: nowrap; }
.flex { display: flex; }
.items-center { align-items: center; }
.items-baseline { align-items: baseline; }
.items-start { align-items: flex-start; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }
.flex-grow { flex-grow: 1; }
.mt-3 { margin-top: 0.4rem; }
.mt-4 { margin-top: 0.5rem; }
.mt-8 { margin-top: 1rem; }
.ml-2 { margin-left: 0.5rem; }
.mb-1 { margin-bottom: 0.25rem; }
.space-y-2 > * + * { margin-top: 0.3rem; }
.w-14 { width: 3.5rem; }
.w-full { width: 100%; }

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.data-table th, .data-table td {
    border: 1px solid #000;
    padding: 3px;
    text-align: center;
    vertical-align: middle;
    word-wrap: break-word;
}
.data-table th {
    background-color: #f8f9fa;
    font-weight: bold;
}
.data-table .col-stt { width: 2%; }
.data-table .col-code { width: 7%; }
.data-table .col-name { width: 16%; text-align: left; }
.data-table .col-model { width: 10%; }
.data-table .col-serial { width: 10%; }
.data-table .col-accessories { width: 18%; text-align: center; }
.data-table .col-condition { width: 15%; }
.data-table .col-note { width: 12%; }
.signature-area { text-align: center; min-width: 180px; }
.signature-space {
    height: 50px;
    border-bottom: 1px solid #ddd;
    margin: 8px 0;
}

@media print {
    body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background-color: #fff !important;
        font-size: 11px;
    }
    .a4-landscape-page {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 1cm 1.2cm 1cm 1cm !important;
        box-shadow: none !important;
        border: none !important;
        page-break-inside: avoid;
    }
    body > *:not(.a4-landscape-page) { display: none !important; }
    .data-table { font-size: 13px; }
    .data-table th, .data-table td { padding: 3px; }
    .data-table thead { display: table-header-group; }
    .data-table tr, .signature-area { page-break-inside: avoid; }
    .print-footer {
        position: fixed;
        bottom: 0.4cm;
        left: 0.6cm;
        right: 0.6cm;
        width: calc(100% - 1.2cm);
    }
    .content-body { padding-bottom: 35px; }
    .editable-cell {
        background-color: transparent !important;
        border-bottom: 1px solid #000 !important;
    }
    .title-main { font-size: 16px; }
    .title-sub { font-size: 13px; }
    .signature-space { height: 40px; }
}

@media (max-width: 768px) {
    .a4-landscape-page {
        width: 100%;
        margin: 0;
        padding: 0.4cm;
        box-shadow: none;
    }
    .title-main { font-size: 16px; }
    .title-sub { font-size: 12px; }
    .data-table { font-size: 9px; }
    .data-table th, .data-table td { padding: 2px 1px; }
}

.edit-instruction {
    font-size: 10px;
    color: #666;
    font-style: italic;
    margin-top: 6px;
    text-align: center;
}
`
