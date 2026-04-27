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
} as const
