Summary of UI mobile fixes (2025-09-26)

- Fixed dropdown/select options not appearing above dialogs on mobile by establishing explicit z-index ordering:
  - Dialog overlay: z-[999]
  - Dialog content: z-[1000]
  - Select/Dropdown portals: z-[1001]

- Scoped mobile CSS overrides in globals.css to [data-radix-dialog-content] only so Radix Select animations/layout are not affected.

- Converted AddMaintenancePlanDialog loai_cong_viec Select to a controlled component (value={field.value}).

- Cleaned debug code: removed console.log/console.warn and debug blocks in maintenance page, add-maintenance-plan dialog, dialog component, and app layout.

Impact:
- Mobile: dropdowns render above overlays and are fully selectable.
- No black-gap artifacts behind dialog; overlay and content stack reliably.
- Safer animations on mobile without affecting other portal components.
