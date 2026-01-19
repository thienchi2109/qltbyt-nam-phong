import type { DriveStep } from "driver.js"

/**
 * Tour IDs for tracking completion state
 */
export const TOUR_IDS = {
  DASHBOARD_WELCOME: "dashboard-welcome",
  SIDEBAR_NAVIGATION: "sidebar-navigation",
} as const

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS]

/**
 * Dashboard Welcome Tour - Introduces users to the main dashboard features
 */
export const dashboardWelcomeTour: DriveStep[] = [
  {
    element: '[data-tour="welcome-banner"]',
    popover: {
      title: "Chào mừng! 👋",
      description:
        "Đây là bảng điều khiển chính của Hệ thống Quản lý Thiết bị Y tế. Hãy cùng khám phá các tính năng chính!",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="kpi-cards"]',
    popover: {
      title: "Thống kê tổng quan",
      description:
        "Xem nhanh số liệu thống kê về thiết bị: tổng số, đang hoạt động, cần bảo trì và đang sửa chữa.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-actions"]',
    popover: {
      title: "Thao tác nhanh",
      description:
        "Truy cập nhanh các chức năng: báo sửa chữa, thêm thiết bị, lập kế hoạch bảo trì và quét mã QR.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="qr-scanner"]',
    popover: {
      title: "Quét mã QR",
      description:
        "Quét mã QR trên thiết bị để xem thông tin chi tiết, ghi nhận sử dụng hoặc báo sửa chữa nhanh chóng.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="calendar-widget"]',
    popover: {
      title: "Lịch bảo trì",
      description:
        "Theo dõi lịch bảo trì định kỳ và các công việc sắp tới của bạn.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="dashboard-tabs"]',
    popover: {
      title: "Bảng thông tin chi tiết",
      description:
        "Xem danh sách thiết bị mới, yêu cầu sửa chữa và công việc bảo trì gần đây.",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "Sẵn sàng bắt đầu! 🎉",
      description:
        "Bạn có thể bắt đầu tour này bất kỳ lúc nào bằng cách nhấn nút Trợ giúp ở góc trên bên phải. Chúc bạn làm việc hiệu quả!",
    },
  },
]

/**
 * Sidebar Navigation Tour - Introduces users to the sidebar navigation elements
 */
export const sidebarNavigationTour: DriveStep[] = [
  {
    element: '[data-tour="sidebar-logo"]',
    popover: {
      title: "Logo & Trang chủ",
      description: "Click vào logo để về trang Dashboard chính.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-dashboard"]',
    popover: {
      title: "Tổng quan",
      description: "Xem tổng quan và thống kê hệ thống.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-equipment"]',
    popover: {
      title: "Thiết bị",
      description: "Quản lý danh sách thiết bị y tế.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-repairs"]',
    popover: {
      title: "Yêu cầu sửa chữa",
      description: "Tạo và theo dõi yêu cầu sửa chữa.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-maintenance"]',
    popover: {
      title: "Bảo trì",
      description: "Lập kế hoạch và quản lý bảo trì định kỳ.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-transfers"]',
    popover: {
      title: "Luân chuyển",
      description: "Quản lý luân chuyển thiết bị giữa các đơn vị.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-reports"]',
    popover: {
      title: "Báo cáo",
      description: "Xem báo cáo và thống kê chi tiết.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav-qr"]',
    popover: {
      title: "Quét QR",
      description: "Quét mã QR để tra cứu thông tin thiết bị nhanh.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-toggle"]',
    popover: {
      title: "Thu gọn/Mở rộng",
      description:
        "Điều chỉnh kích thước thanh bên để có thêm không gian làm việc.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "Hoàn thành! 🎉",
      description:
        "Bạn đã nắm được cách điều hướng. Sử dụng nút Trợ giúp để xem lại bất kỳ lúc nào!",
    },
  },
]

/**
 * All tour configurations mapped by tour ID
 */
export const TOUR_CONFIGS: Record<TourId, DriveStep[]> = {
  [TOUR_IDS.DASHBOARD_WELCOME]: dashboardWelcomeTour,
  [TOUR_IDS.SIDEBAR_NAVIGATION]: sidebarNavigationTour,
}
