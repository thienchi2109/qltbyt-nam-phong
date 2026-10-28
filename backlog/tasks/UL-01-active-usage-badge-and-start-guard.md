# UL-01 — Badge Đang sử dụng và khóa Bắt đầu sử dụng thiết bị

- Status: To Do
- Created: 2026-10-28
- Milestone: Equipment / Usage log
- Dependencies: None
- Survey baseline: `4e308be738e04565e3014876a35beec19727ca41`

## Mục tiêu và phạm vi đã chốt

Khi nhân viên bắt đầu sử dụng thiết bị thành công, hiển thị badge **Đang sử dụng**
và disable **Bắt đầu sử dụng** cho thiết bị đó, kể cả với người đang sử dụng.
Sau khi kết thúc thành công, bỏ badge và enable lại nút theo phân quyền hiện có.
Áp dụng nhất quán trên desktop và mobile, tại các điểm thao tác nhật ký hiện có.

Người dùng đã chọn **TanStack Query polling mỗi 5 giây**, không dùng Realtime.
Máy vừa thao tác cập nhật ngay sau khi server xác nhận; máy khác cập nhật ở lần
polling tiếp theo khi trang đang hoạt động và kết nối bình thường. Refetch khi
quay lại tab hoặc kết nối mạng được khôi phục.

Task này ghi nhận yêu cầu triển khai; chưa bắt đầu sửa code hoặc thao tác DB.

## Hiện trạng từ khảo sát read-only

- `src/hooks/use-usage-logs.ts`: đã có batch active query theo tenant/dataset,
  truyền đủ chín named arguments cho `usage_log_list`. Polling mặc định 2 phút,
  danh sách thiết bị override thành 5 phút. Start/end invalidation chỉ tác động
  cache trên máy vừa thao tác.
- `src/components/equipment/equipment-actions-menu.tsx`: đã chặn Bắt đầu khi
  loading hoặc có phiên active, nhưng chưa có badge rõ ràng; query lỗi có thể
  khiến dữ liệu vắng mặt bị hiểu thành thiết bị rảnh.
- `src/components/mobile-usage-actions.tsx`: có thông báo thiết bị đang dùng,
  nhưng chưa dùng loading/error của active query để khóa Bắt đầu.
- Active query chỉ lấy `p_limit: 200`, `p_offset: 0`, chưa tải tiếp. Nếu vượt
  200 phiên trong scope, một thiết bị đang dùng có thể không xuất hiện trong
  kết quả. Chưa xác nhận tình huống này đang xảy ra trên dữ liệu thực tế.
- `supabase/migrations/20261009101500_usage_session_start_terminal_guard.sql`:
  RPC start khóa hàng thiết bị bằng `FOR UPDATE`, kiểm tra phiên active rồi
  insert. Đây là guard ở RPC; chưa kiểm chứng concurrency bằng runtime và chưa
  tìm thấy unique constraint tương ứng trong migrations được khảo sát.

## Acceptance criteria

- [ ] Badge có đúng nhãn **Đang sử dụng**, xuất hiện rõ ràng trên desktop và
      mobile khi thiết bị có phiên active; badge và nút cùng dùng dữ liệu query.
- [ ] Khi active, Bắt đầu bị disable cho mọi nhân viên, kể cả owner. Giữ nguyên
      phân quyền/scope và khả năng Kết thúc hiện có; không mở rộng quyền.
- [ ] Start/end dùng trạng thái pending hiện có để ngăn thao tác lặp. Chỉ sau
      server success mới chuyển trạng thái tương ứng; end thất bại không làm
      mất badge hoặc mở lại Bắt đầu.
- [ ] Dùng lại TanStack Query hook, query keys và batch RPC hiện có; polling
      mỗi 5 giây khi trang đang hoạt động. Không tạo request riêng cho từng
      hàng thiết bị, không thêm Realtime hoặc dependency mới.
- [ ] Sau start/end thành công, cập nhật cache và invalidate/refetch các query
      liên quan để UI trên máy thao tác phản ánh ngay kết quả server. Máy khác
      phản ánh thay đổi ở chu kỳ polling tiếp theo trong điều kiện bình thường.
- [ ] Refetch khi quay lại tab hoặc mạng được khôi phục; cache và các cập nhật
      luôn tách theo tenant/dataset, không dùng dữ liệu scope trước để mở nút.
- [ ] Khi chưa xác định được trạng thái hoặc query lỗi, không coi thiết bị là
      rảnh: khóa Bắt đầu, thể hiện loading/lỗi và cho phép thử lại theo mẫu có
      sẵn. Refetch lỗi không xóa trạng thái active đã biết.
- [ ] Active query xử lý đầy đủ dữ liệu trong scope, kể cả hơn 200 phiên;
      không suy luận thiết bị rảnh từ một trang kết quả bị cắt. Ưu tiên tái sử
      dụng pagination/RPC hiện có và giữ cách lấy dữ liệu theo batch.
- [ ] Giữ guard server khi hai nhân viên Bắt đầu gần đồng thời. Client bị từ
      chối phải hiển thị lỗi dễ hiểu và refetch trạng thái; không chỉ dựa vào
      nút disable để bảo vệ phiên sử dụng.

## Kiểm chứng khi triển khai

- Regression tests bảo vệ badge/disable trên desktop và mobile, pending,
  loading/error, start/end success/failure, scope tenant/dataset và dữ liệu
  active vượt 200 phiên; dùng QueryClient thực và RPC mocks ổn định.
- Kiểm chứng polling bằng fake timers và hai QueryClient độc lập: start/end
  trên client A cập nhật client B ở chu kỳ 5 giây tiếp theo; kiểm tra focus và
  reconnect. Không coi invalidation local là đồng bộ giữa hai máy.
- Smoke hai browser sessions: A bắt đầu → B thấy badge và không thể bắt đầu;
  kết thúc → B thấy badge biến mất và nút mở lại. Kiểm chứng hai lượt start
  đồng thời chỉ tạo một phiên trên môi trường test được phép; ghi rõ môi
  trường và bằng chứng, không suy ra live PASS từ source inspection.
- Với diff TypeScript/React, chạy đúng thứ tự: formatting →
  `verify:no-explicit-any` → `verify:dedupe` → `typecheck` → focused tests →
  `react-doctor`, qua `node scripts/npm-run.js`. Thực hiện semantic reuse check
  theo skill `code-deduplication` trước khi thêm logic dùng chung.
- Nếu phát sinh SQL migration, áp dụng Database Quality Gate của repo;
  static và baseline-forward phải được báo riêng trên cùng exact commit.
  Mọi live DB write vẫn cần sự cho phép riêng cho thao tác đó.

## Điểm mã nguồn liên quan

- `src/hooks/use-usage-logs.ts`
- `src/app/(app)/equipment/_hooks/useEquipmentData.ts`
- `src/app/(app)/equipment/use-equipment-page.tsx`
- `src/components/equipment/equipment-actions-menu.tsx`
- `src/components/mobile-usage-actions.tsx`
- `src/providers/query-provider.tsx`
- `src/components/start-usage-dialog.tsx`
- `src/components/end-usage-dialog.tsx`
- `supabase/migrations/20261014120000_equipment_dataset_scope.sql`
- `supabase/migrations/20260415040000_fix_usage_session_end_admin_guard.sql`
