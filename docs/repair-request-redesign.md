
# Repair Request Page Redesign Proposal

This document outlines a proposal for a redesigned repair request page, focusing on a more modern, elegant, and professional user interface. The goal is to improve the user experience by enhancing clarity, streamlining workflows, and providing better data visualization.

## 1. Current UI Analysis

The current repair request page is functional but suffers from a few key weaknesses:

*   **Information Overload:** The "Create New Request" form and the data table of existing requests are presented on the same page, leading to a cluttered and overwhelming interface.
*   **Poor Visual Hierarchy:** The primary focus is on the creation form, while the list of existing requests is hidden by default. This is not ideal for users who primarily need to manage and monitor requests.
*   **Suboptimal UX Flow:** Users have to scroll to find the list of requests, and the toggle button is not intuitive.
*   **Dated Aesthetics:** The overall design is functional but lacks the polish and visual appeal of modern web applications.

## 2. Design Inspirations

The proposed redesign is inspired by modern dashboard and data management interfaces found on platforms like Dribbble and Mobbin. Key trends include:

*   **Clean & Minimalist Layouts:** Ample white space, clear typography, and a focus on essential information.
*   **Two-Column Layouts:** A common pattern that separates primary content from secondary actions or information.
*   **Card-Based Design:** Using cards to create a visually organized and modular layout.
*   **Prominent Calls-to-Action (CTAs):** Clear and easily accessible buttons for primary user actions.
*   **Data Visualization:** Using charts and summary statistics to provide at-a-glance insights.

## 3. Proposed Redesign

The redesign is based on a two-column layout that separates the main data grid from the creation form, providing a more organized and intuitive user experience.

### 3.1. Main Layout

```
+-------------------------------------------------------------------------------------------------+
| [Header: Repair Requests]                                                                       |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|  [Summary Card: Total Requests] [Summary Card: Pending] [Summary Card: In Progress] [Summary Card: Completed] |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|  +------------------------------------------------------+  +-----------------------------------+  |
|  |                                                      |  |                                   |  |
|  |  [Left Column: Repair Requests List]                 |  |  [Right Column: Action Hub]         |  |
|  |                                                      |  |                                   |  |
|  |  +------------------------------------------------+  |  |  +-------------------------------+  |
|  |  | [Search Bar] [Filter Button] [Export Button]   |  |  |  |                               |  |
|  |  +------------------------------------------------+  |  |  |  [Create New Repair Request]    |  |
|  |                                                      |  |  |                               |  |
|  |  +------------------------------------------------+  |  |  |  Step 1: Select Equipment     |  |
|  |  |                                                |  |  |  ...                             |  |
|  |  |  [Data Table of Repair Requests]               |  |  |                               |  |
|  |  |                                                |  |  |  Step 2: Describe Issue       |  |
|  |  |                                                |  |  |  ...                             |  |
|  |  |                                                |  |  |                               |  |
|  |  |                                                |  |  |  Step 3: Review & Submit      |  |
|  |  |                                                |  |  |  ...                             |  |
|  |  +------------------------------------------------+  |  |                               |  |
|  |                                                      |  |  +-------------------------------+  |
|  +------------------------------------------------------+  |                                   |  |
|                                                          +-----------------------------------+  |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

### 3.2. Left Column: Repair Requests List

This will be the primary focus of the page.

*   **Summary Cards:** Four cards at the top will provide a quick overview of the repair requests:
    *   **Total Requests:** Total number of requests.
    *   **Pending Approval:** Requests waiting for approval.
    *   **In Progress:** Requests that are currently being worked on.
    *   **Completed:** Requests that have been resolved.
*   **Action Bar:** A clean action bar above the table will include:
    *   A prominent **search bar**.
    *   A **filter button** that opens a modal with advanced filtering options (by status, department, date range, etc.).
    *   An **export button** to export the data to CSV or Excel.
*   **Redesigned Data Table:**
    *   **Improved Readability:** Increased padding, clearer typography, and alternating row colors.
    *   **Prominent Status Indicators:** The status of each request will be displayed as a colored badge (e.g., red for "Pending," yellow for "In Progress," green for "Completed").
    *   **Inline Actions:** Instead of a dropdown menu, each row will have icon-based buttons for common actions (e.g., "View Details," "Edit," "Delete").
    *   **Expandable Rows:** Clicking on a row will expand it to show more detailed information, such as the issue description, repair history, and comments, without navigating to a new page.

### 3.3. Right Column: Action Hub

This sidebar will be dedicated to creating new repair requests.

*   **"Create New Repair Request" Form:**
    *   **Stepper Component:** The form will be broken down into a multi-step process to guide the user:
        1.  **Select Equipment:** A searchable dropdown or a modal to select the equipment that needs repair.
        2.  **Describe Issue:** A text area for the user to describe the problem in detail.
        3.  **Review & Submit:** A final review step that summarizes the information before submission.
    *   **Visual Progress Indicators:** The stepper will visually indicate the user's progress through the form.

### 3.4. Mobile Experience

*   **Single-Column Layout:** On mobile devices, the layout will adapt to a single column. The summary cards will be displayed at the top, followed by the data table.
*   **Floating Action Button (FAB):** A FAB at the bottom-right of the screen will allow users to create a new repair request. Tapping the FAB will open the creation form in a full-screen modal.

## 4. Benefits of the Redesign

*   **Improved User Experience:** The two-column layout and stepper form will make the page more intuitive and less overwhelming.
*   **Enhanced Clarity:** The redesigned data table and prominent status indicators will make it easier for users to find and understand the information they need.
*   **Modern Aesthetics:** The clean, minimalist design will give the application a more professional and up-to-date look and feel.
*   **Streamlined Workflow:** The inline actions and expandable rows will allow users to perform common tasks more efficiently.

## Next steps

- Desktop split view polish
  - Add view-mode toggle (Split / Full / Auto), persisted per user.
  - Auto-collapse Action Hub if table viewport < ~920px; show a toast hint when auto-hidden.
  - Acceptance: toggle visible in header; width persistence works; auto-collapse triggers and is reversible.

- Action Bar enhancements (UI-only)
  - Filter chips under search; advanced FilterModal (status, department/facility, date range); export to CSV/XLSX.
  - Column visibility presets: Compact / Standard / Full; density and text-wrap toggles saved in localStorage.
  - Acceptance: chips accurately reflect filters; presets switch visible columns; settings persist across reloads.

- Table readability and interactions
  - Sticky first columns (Mã, Thiết bị) on wide tables; keyboard shortcuts: / (focus search), n (new), Enter (open details).
  - SLA highlights: subtle colored sidebars for nearing/overdue desired date on non-completed rows.
  - Acceptance: sticky behavior on horizontal scroll; shortcuts work without interfering with inputs; SLA colors match states.

- Details experience
  - Convert current modal details to a right slide-over drawer on desktop (keep modal on mobile).
  - Acceptance: drawer opens from row click, supports scroll, and closes with Esc/backdrop.

- Saved filter sets (optional)
  - Allow saving/loading named filter combos (e.g., “Chờ duyệt • Khoa HSCC”).
  - Acceptance: create, apply, delete sets; persisted per user.

- KPI reuse
  - Reuse SummaryBar in Dashboard KPIs; wire to existing server-side functions.
  - Acceptance: identical visual style; clicking KPIs navigates/filters appropriately.

Notes
- No backend/schema changes required; continue using existing RPCs. If statistics need better performance, consider batching counts in a server function later (non-blocking).
