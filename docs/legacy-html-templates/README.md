# Legacy HTML Templates (Archived)

These HTML templates were used during early prototyping and are no longer referenced by the application. They have been archived here for historical reference and can be safely deleted.

Archived files and their modern replacements:

- handover_template.html → Next route: src/app/(app)/forms/handover-template/page.tsx
  - Component: src/components/handover-template.tsx
- handover_update.html → Next route: src/app/(app)/forms/handover-update/page.tsx
  - Component: src/components/handover-template.tsx
- log_template.html → Next route: src/app/(app)/forms/log-template/page.tsx
  - Component: src/components/log-template.tsx
- maintainance-html-form.html → Next route: src/app/(app)/forms/maintenance/page.tsx
  - Component: src/components/maintenance-form.tsx

Notes:
- Verified via repo-wide search that no code references these standalone HTML files (no imports, links, or runtime usage).
- The React/Next.js pages provide the same print-optimized layouts with branding and dynamic data.
- If you need static exports for offline use, prefer rendering the React pages to PDF/HTML rather than reviving these files.
