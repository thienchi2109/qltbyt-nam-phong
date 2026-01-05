import type { DriveStep } from "driver.js"

/**
 * Tour IDs for tracking completion state
 */
export const TOUR_IDS = {
  DASHBOARD_WELCOME: "dashboard-welcome",
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
 * All tour configurations mapped by tour ID
 */
export const TOUR_CONFIGS: Record<TourId, DriveStep[]> = {
  [TOUR_IDS.DASHBOARD_WELCOME]: dashboardWelcomeTour,
}
