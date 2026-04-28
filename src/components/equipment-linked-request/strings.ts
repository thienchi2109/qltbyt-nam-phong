export const STRINGS = {
  buttonSingleActive: 'Yêu cầu sửa chữa hiện tại',
  buttonMultiActive: (count: number) =>
    `${count} yêu cầu sửa chữa active — mở bản mới nhất`,
  buttonAriaLabel: (maThietBi: string) =>
    `Yêu cầu sửa chữa hiện tại của thiết bị ${maThietBi}`,
  multiActiveAlert: (count: number) =>
    `Phát hiện ${count} yêu cầu active. Đang hiển thị bản cập nhật mới nhất. Để xem tất cả, mở danh sách trên trang Yêu cầu sửa chữa.`,
  footerOpenInRepairRequests: 'Mở trong trang Yêu cầu sửa chữa',
  autoCloseToastTitle: 'Yêu cầu đã được hoàn thành',
  resolveLoadingTitle: 'Đang mở yêu cầu sửa chữa',
  resolveLoadingDescription: 'Vui lòng chờ trong giây lát.',
  resolveErrorTitle: 'Không thể mở yêu cầu sửa chữa',
  resolveErrorDescription: 'Vui lòng thử lại từ danh sách thiết bị.',
  rowIndicatorTooltip: 'Xem phiếu yêu cầu sửa chữa',
  rowIndicatorAriaLabel: (maThietBi: string) =>
    `Xem yêu cầu sửa chữa hiện tại của thiết bị ${maThietBi}`,
} as const
