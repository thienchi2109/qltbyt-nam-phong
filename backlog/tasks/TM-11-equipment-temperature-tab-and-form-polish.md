# TM-11 — Tách tab Sổ theo dõi nhiệt độ và đồng bộ form

- Status: Done
- Created: 2026-10-27
- Milestone: Temperature Monitoring / Equipment detail UX
- Related tasks: TM-02, TM-07
- Master reference: `docs/specs/temperature-monitoring.md`

## Mục tiêu và phạm vi đã chốt

Chuyển nguyên phần nhiệt độ hiện có trong detail dialog của thiết bị sang tab
**Sổ theo dõi nhiệt độ**, đặt ngay sau **Cấu hình & Phụ kiện**. Đồng bộ typography,
spacing và bộ chọn theo các component shadcn hiện có trong repo.

Người dùng đã xác nhận chuyển phần hiện có: tóm tắt, form cấu hình và nút
**Mở sổ nhiệt độ**. Nút tiếp tục mở `/temperature-monitoring?equipment=<id>`;
không nhúng form nhập số đo, biểu đồ hoặc xuất file vào dialog.

Người dùng đã cho phép triển khai ngày 2026-10-27 theo phạm vi đã chốt.
Plan `docs/plans/2026-10-27-tm11-implementation-plan.md` đã được parent và reviewer
độc lập duyệt trên base `04fbf9fc`. Implementation, kiểm chứng và review cuối
đã hoàn tất trên branch riêng; chưa merge vào main hoặc deploy production.

## Acceptance criteria

- [x] Tab có đúng tên **Sổ theo dõi nhiệt độ**, luôn hiện trong hàng tab của detail
      dialog; cuộn ngang và điều hướng bàn phím vẫn hoạt động trên màn hình nhỏ.
- [x] Chuyển tóm tắt, cấu hình theo dõi và nút mở sổ sang tab mới. Tab
      **Cấu hình & Phụ kiện** giữ các trường cấu hình thiết bị và phụ kiện.
- [x] Giữ phân quyền hiện có: `admin`/`global` và `to_qltb` được cấu hình trong
      scope hợp lệ; người chỉ đọc không có thao tác lưu. Manager vẫn thiết lập
      được khi chưa có cấu hình. Giữ nguyên hành vi trong chế độ sửa thiết bị.
- [x] Giữ font chung của dialog. Tiêu đề mục dùng `text-base font-semibold`;
      nhãn tóm tắt dùng `text-xs font-medium text-muted-foreground`; giá trị dùng
      `text-base font-medium`; nhãn ô nhập dùng `Label` với `text-sm font-medium`;
      mô tả dùng `text-sm text-muted-foreground`. Số nhiệt độ dùng `tabular-nums`.
- [x] Mỗi nhóm nhãn/control có khoảng cách 8px, giữa các nhóm 16px, gồm trường
      **Lý do thay đổi**. Ô nhập giữ cỡ chữ dễ đọc trên điện thoại, không tràn ở
      chiều rộng nhỏ; nhãn liên kết đúng control.
- [x] **Hồ sơ ca**, **Cách ghi nhận**, **Phụ trách chính** dùng shadcn `Select`
      hiện có, thay native select. **Nhân sự thay thế** dùng bộ chọn nhiều dựa
      trên primitives/pattern shadcn sẵn có; giữ khả năng chọn và bỏ nhiều người.
- [x] Đổi control không làm mất giá trị mặc định/đã chọn, nhân sự ngoài trang
      tìm kiếm hiện tại hoặc dữ liệu gửi khi lưu. Bảo toàn hợp đồng các trường
      `profile`, `method`, `primary` và danh sách `substitutes`.
- [x] **Lý do thay đổi** vẫn bắt buộc, tối đa 2000 ký tự; validation hiển thị rõ
      khi chặn lưu. Giữ loading/pending, chống lưu trùng, thông báo lỗi và cache
      invalidation hiện có; không tạo thêm cơ chế loading riêng.
- [x] Chưa mở tab nhiệt độ thì không gọi các RPC cấu hình nhiệt độ. Giữ cơ chế
      mount theo tab; không thêm `forceMount` làm phát sinh truy vấn ở tab ẩn.
- [x] Lưu thành công rồi rời/quay lại tab hoặc mở lại dialog hiển thị dữ liệu
      server. Không mở rộng task sang lưu bản nháp chưa submit giữa các tab;
      hiện bản nháp reset khi component unmount.
- [x] Giữ regression PR #1010 và hotfix `25004f33`: không crash với dữ liệu null,
      không hiển thị `null–null °C`, ngưỡng `0°C` vẫn hợp lệ.

## Điểm vào và kiểm chứng khi triển khai

- `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTabs.tsx`
- `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab.tsx`
- `src/hooks/use-temperature-configuration.ts`
- `src/hooks/__tests__/temperature-configuration-persistence.test.tsx`
- `src/hooks/__tests__/temperature-configuration-selection.test.tsx`
- `src/components/ui/select.tsx`, `src/components/ui/label.tsx`

Cập nhật test mở tab thật sang tên mới; bảo vệ phân quyền, lazy queries, lưu và
refetch/remount, validation lý do, chọn một/chọn nhiều và các ca ngưỡng null/0°C.
Kiểm tra trực quan spacing/typography, dropdown trong dialog, focus và mobile.
Chạy các gate TS/React theo thứ tự trong `AGENTS.md` và review độc lập trước
khi tích hợp. Không cần thay đổi SQL/RPC hoặc dữ liệu live cho phạm vi này.

## Khảo sát đã có

Hai scout `gpt-6-luna/max` khảo sát read-only trên `b95d0343`; chưa chạy test,
build hoặc sửa code. Form nhập số đo thực tế nằm ở trang sổ riêng. Graph cũ
không được refresh; các kết luận được đối chiếu bằng source hiện hành.

## Bằng chứng triển khai 2026-10-27

- Plan đã duyệt: `docs/plans/2026-10-27-tm11-implementation-plan.md`.
- Baseline 11/11 PASS; RED 6 ca tab thật thiếu tab nhiệt độ, giữ các ca
  future-only/null/0°C; GREEN mở rộng 18/18 PASS.
- Chuyển toàn bộ nhiệt độ vào tab lazy riêng, giữ hook/RPC/cache invalidation
  và form cấu hình/phụ kiện hiện có. Tái sử dụng shadcn Select/Label và pattern
  DropdownMenuCheckboxItem; submit thật kiểm chứng profile/method/primary và
  toàn bộ substitutes, kể cả nhân sự ngoài trang hiện tại.
- Regression trong dialog thật phát hiện các Radix focus/layer stack cài đặt
  độc lập: container portal native và Escape boundary chỉ cho selector của tab
  này giữ dialog, bản nháp lý do và focus. Default primitives không đổi;
  không thêm dependency. Lỗi focus recursion được chứng minh trong jsdom,
  không khẳng định đã tái hiện trong Chrome.
- Gate cuối trên toàn bộ 8 file JS/TS đã stage đều exit 0: format, TS docstrings,
  no-explicit-any, dedupe diff-only, typecheck, focused tests 18/18
  (08:49 UTC), React Doctor 92/100. Còn một advisory `no-prevent-default`
  có chủ đích cho submit FormData; reviewer xác nhận nonblocking. Điểm 100/100
  trước staging không bao phủ hai component mới nên không dùng làm kết quả cuối.
- Browser fixture của parent PASS: mobile viewport/body 390px, gap nhãn/control
  8px, chữ input 16px, single/multi-select và Escape/focus/bản nháp, validation
  và FormData đầy đủ. Đây là disposable UI với hook/NextLink fixture, chưa phải
  full Next.js/production UAT.
- Parent và reviewer độc lập đã chốt SPEC PASS, QUALITY/STANDARDS PASS.
  Report: `docs/reports/temperature-monitoring-tm11-ui-2026-10-27.md`.
  Source đã kiểm chứng trên branch riêng; chưa merge/deploy. Không có SQL/live
  DB write.
