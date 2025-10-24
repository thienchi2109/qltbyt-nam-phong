## Why
- FAB was hidden behind the bottom mobile navbar making it untouchable.
- Repair Requests Summary cards should have clear, elegant pastel colors by status for quick scanning.

## What Changes
- Move/tier the floating "Tạo yêu cầu" button above the mobile footer with safe-area spacing and higher z-index.
- Update StatCard styling to use pastel backgrounds by tone (success/warning/danger/muted/default) used in the Repair Requests SummaryBar.

## Impact
- Affected code:
  - src/app/(app)/repair-requests/page.tsx (FAB positioning)
  - src/app/globals.css (new utility .fab-above-footer; adjusted mobile-footer z-index)
  - src/components/ui/stat-card.tsx (pastel styling for SummaryBar cards)
- No backend changes.
