# Sidebar Navigation Tour Design

**Date:** 2026-01-05
**Status:** Approved
**Approach:** Static Tour with data-tour Attributes (Approach A)

## Overview

Add a sidebar navigation tour to complement the existing dashboard welcome tour. This tour teaches users about the sidebar menu and navigation options.

## Requirements

- **Scope:** All nav items (7-9 steps depending on role consideration)
- **Integration:** Separate tour option in HelpButton dropdown
- **Platform:** Desktop only (sidebar hidden on mobile)

## Design

### 1. Tour Configuration

**New TOUR_ID:** `SIDEBAR_NAVIGATION`

**Tour Steps:**

| Step | data-tour Attribute | Title (Vietnamese) | Description |
|------|---------------------|-------------------|-------------|
| 1 | `sidebar-logo` | Logo & Trang chủ | Click để về trang chủ Dashboard |
| 2 | `sidebar-nav-dashboard` | Tổng quan | Xem tổng quan và thống kê hệ thống |
| 3 | `sidebar-nav-equipment` | Thiết bị | Quản lý danh sách thiết bị y tế |
| 4 | `sidebar-nav-repairs` | Yêu cầu sửa chữa | Tạo và theo dõi yêu cầu sửa chữa |
| 5 | `sidebar-nav-maintenance` | Bảo trì | Lập kế hoạch bảo trì định kỳ |
| 6 | `sidebar-nav-transfers` | Luân chuyển | Quản lý luân chuyển thiết bị |
| 7 | `sidebar-nav-reports` | Báo cáo | Xem báo cáo và thống kê chi tiết |
| 8 | `sidebar-nav-qr` | Quét QR | Quét mã QR thiết bị |
| 9 | `sidebar-toggle` | Thu gọn/Mở rộng | Điều chỉnh kích thước thanh bên |
| 10 | (no element) | Hoàn thành! | Tóm tắt và kết thúc tour |

**Note:** Admin-only items (Users, Activity Logs) are excluded from tour for simplicity.

### 2. File Changes

#### `src/components/onboarding/tour-configs.ts`
- Add `SIDEBAR_NAVIGATION` to `TOUR_IDS`
- Create `sidebarNavigationTour: DriveStep[]` array
- Add to `TOUR_CONFIGS` mapping

#### `src/app/(app)/layout.tsx`
- Add `data-tour="sidebar-logo"` to logo Link (line ~138)
- Add `data-tour` attributes to nav items via href mapping
- Add `data-tour="sidebar-toggle"` to toggle Button (line ~226)

#### `src/components/onboarding/HelpButton.tsx`
- Add sidebar tour menu item to dropdown
- Track `sidebarCompleted` state
- Fix hover background color issue (white text overlap)
- Show visual indicator if tour not completed

### 3. UI Fix

**Issue:** HelpButton dropdown menu items have white text that becomes invisible on hover due to background color overlap.

**Fix:** Update hover styles to use darker text or different background:
- Change from `hover:bg-primary/10` to appropriate contrast
- Ensure text remains readable on hover state

## Implementation Tasks

1. Add data-tour attributes to layout.tsx sidebar elements
2. Create sidebarNavigationTour in tour-configs.ts
3. Add SIDEBAR_NAVIGATION to TOUR_IDS
4. Update HelpButton with new dropdown item
5. Fix HelpButton hover color issue
6. Test tour functionality

## Dependencies

- Existing Driver.js infrastructure
- useTour hook (no changes needed)
- HelpButton component
