# Logo Update - September 2025

## Logo Change Details
- **New Logo URL**: https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png
- **Logo Type**: Transparent background (no background)
- **Previous Logo**: https://i.postimg.cc/fRgcxRtz/Logo-CDC-250x250.jpg (rounded logo)

## Files Updated

### Main Logo Component
- `src/components/icons.tsx` - Updated main Logo component
  - Changed URL and removed `rounded-full` class
  - Added `object-contain` class for better rendering

### React Components with Hardcoded Logos
- `src/app/(app)/equipment/page.tsx`
- `src/app/(app)/maintenance/page.tsx` 
- `src/app/(app)/repair-requests/page.tsx`
- `src/components/usage-log-print.tsx`
- `src/components/handover-preview-dialog.tsx`

### Static HTML Templates
- `handover_template.html`
- `handover_update.html`
- `log_template.html`
- `login_page_template.html`
- `maintainance-html-form`

## Styling Considerations
- New logo has transparent background, so removed circular styling
- Updated CSS classes to `object-contain` for proper aspect ratio preservation
- Logo works well across all UI contexts (login, dashboard, print views)