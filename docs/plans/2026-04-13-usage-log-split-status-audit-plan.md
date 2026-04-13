# Plan: Tách trạng thái đầu/cuối cho nhật ký sử dụng thiết bị (TDD + SQL-safe)

## Mục tiêu

Tách rõ trạng thái thiết bị ở 2 thời điểm trong cùng một phiên sử dụng để phục vụ audit/điều tra:

- `tinh_trang_ban_dau`
- `tinh_trang_ket_thuc`

Flow mới không ghi dữ liệu mới vào cột legacy `tinh_trang_thiet_bi`.

## Quyết định kỹ thuật đã chốt

1. **Tên cột chính xác**
   - `tinh_trang_ban_dau` (text)
   - `tinh_trang_ket_thuc` (text)

2. **Cột legacy `tinh_trang_thiet_bi`**
   - Giữ lại để đọc dữ liệu cũ và backward-read.
   - Không còn là nguồn ghi chính cho flow mới.

3. **Backfill dữ liệu cũ**
   - Backfill `tinh_trang_ban_dau` từ `tinh_trang_thiet_bi` khi cột mới đang null.
   - Backfill `tinh_trang_ket_thuc` từ `tinh_trang_thiet_bi` cho bản ghi đã `trang_thai='hoan_thanh'` khi cột mới đang null.
   - Lý do: dữ liệu lịch sử không thể phục hồi chính xác trước/sau; phương án này giữ tính liên tục báo cáo và tránh ô trống hàng loạt.

4. **Input free-text + gợi ý**
   - Chọn approach `Input + datalist` (native), không thêm thư viện UI mới.
   - Vẫn cung cấp danh sách gợi ý chuẩn nghiệp vụ.

5. **Validation level**
   - FE: Zod bắt buộc nhập ở cả start và end.
   - BE (RPC): bắt buộc ở server-side để fail-closed khi bypass UI.
   - DB: cột mới thêm dạng nullable ở vòng này; ràng buộc bắt buộc thực thi qua RPC để tránh làm fail migration trên dữ liệu legacy bẩn.

## TDD Execution Flow

## Phase 1 — Database-first tests (RED)

Tạo smoke test SQL mới (theo pattern `supabase/tests/*_smoke.sql`) trước khi sửa RPC:

- `supabase/tests/usage_log_split_status_smoke.sql`
  1. Assert cột `tinh_trang_ban_dau`, `tinh_trang_ket_thuc` tồn tại.
  2. `usage_session_start` fail khi thiếu trạng thái ban đầu.
  3. `usage_session_start` pass khi có trạng thái ban đầu và ghi đúng cột mới.
  4. `usage_session_end` fail khi thiếu trạng thái kết thúc.
  5. `usage_session_end` pass khi có trạng thái kết thúc và ghi đúng cột mới.
  6. Cả 2 overload `usage_log_list` trả về 2 field mới trong JSON.
  7. Assert `usage_session_end` có function-level `search_path=public, pg_temp`.

## Phase 2 — DB implementation (GREEN)

Tạo migration mới:

- `supabase/migrations/YYYYMMDDHHMMSS_usage_log_split_status_columns.sql`

Nội dung chính:

1. **Schema**
   - `ALTER TABLE public.nhat_ky_su_dung ADD COLUMN IF NOT EXISTS tinh_trang_ban_dau text;`
   - `ALTER TABLE public.nhat_ky_su_dung ADD COLUMN IF NOT EXISTS tinh_trang_ket_thuc text;`

2. **Backfill**
   - Update `tinh_trang_ban_dau` từ cột legacy.
   - Update `tinh_trang_ket_thuc` cho session hoàn thành từ cột legacy.

3. **RPC updates**
   - `usage_session_start(...)`
     - Thêm param mới `p_tinh_trang_ban_dau`.
     - Validate non-empty.
     - Ghi `tinh_trang_ban_dau`.
   - `usage_session_end(...)`
     - Thêm param mới `p_tinh_trang_ket_thuc`.
     - Validate non-empty.
     - Ghi `tinh_trang_ket_thuc`.
     - **MUST** khai báo `SET search_path = public, pg_temp` ở DDL header (không chỉ `set_config` trong body).
   - `usage_log_list` overload 8-param.
   - `usage_log_list` overload 7-param (legacy search/report path).
     - Cả 2 overload phải project thêm 2 field mới.

4. **Security and pattern compliance**
   - `SECURITY DEFINER` + function-level `SET search_path = public, pg_temp`.
   - Giữ pattern tenant guard hiện tại (`allowed_don_vi_for_session`, role checks).
   - Với overload có query text, tiếp tục dùng `_sanitize_ilike_pattern`.
   - Cập nhật `GRANT EXECUTE` đúng chữ ký mới.

## Phase 3 — Frontend tests first (RED)

Tạo/cập nhật test fail trước khi sửa UI:

- `src/components/__tests__/start-usage-dialog.validation.test.tsx`
  - Không cho submit khi thiếu trạng thái ban đầu.
  - Cho submit khi nhập free-text hợp lệ.

- `src/components/__tests__/end-usage-dialog.validation.test.tsx`
  - Không cho submit khi thiếu trạng thái kết thúc.
  - Cho submit khi nhập hợp lệ.

- `src/components/__tests__/usage-log-print.columns.test.tsx`
  - Print HTML/CSV có đủ 2 cột: trạng thái ban đầu/kết thúc.

- `src/components/__tests__/log-template.columns.test.tsx`
  - `LogTemplate` render 2 cột tình trạng.

## Phase 4 — Frontend implementation (GREEN)

1. `src/components/start-usage-dialog.tsx`
   - Đổi field form thành `tinh_trang_ban_dau`.
   - Input free-text + datalist gợi ý.
   - Gửi payload mới xuống mutation.

2. `src/components/end-usage-dialog.tsx`
   - Đổi field thành `tinh_trang_ket_thuc`.
   - Bắt buộc nhập trong confirm dialog.
   - Gửi payload mới xuống mutation.

3. `src/hooks/use-usage-logs.ts`
   - Update mutation payload cho start/end.
   - Parse/consume response với 2 field mới.

4. `src/types/database.ts`
   - `UsageLog` thêm:
     - `tinh_trang_ban_dau?: string | null`
     - `tinh_trang_ket_thuc?: string | null`

5. `src/components/usage-history-tab.tsx`
   - Hiển thị tách bạch trạng thái ban đầu/kết thúc.
   - Fallback đọc cột legacy cho bản ghi chưa backfill đầy đủ.

6. Print template
   - `src/components/log-template.tsx`:
     - `UsageLogEntry.condition` -> tách thành 2 field.
     - Header bảng đổi thành 2 cột tình trạng.
   - `src/components/usage-log-print.tsx`:
     - Bảng in + CSV thêm 2 cột tình trạng.
     - File hiện 526 lines (>450), cần tách trước khi thêm logic mới.

## Refactor requirement (file ceiling)

Do `usage-log-print.tsx` đang vượt ceiling:

- Tách trước các khối lớn sang file mới có prefix module:
  - `src/components/UsageLogPrintHtmlBuilder.ts`
  - `src/components/UsageLogPrintCsvBuilder.ts`

Mục tiêu: đưa file chính xuống dưới 450 lines trước khi mở rộng cột.

## Danh sách file dự kiến thay đổi

```text
supabase/migrations/YYYYMMDDHHMMSS_usage_log_split_status_columns.sql
supabase/tests/usage_log_split_status_smoke.sql
src/types/database.ts
src/hooks/use-usage-logs.ts
src/components/start-usage-dialog.tsx
src/components/end-usage-dialog.tsx
src/components/usage-history-tab.tsx
src/components/log-template.tsx
src/components/usage-log-print.tsx
src/components/UsageLogPrintHtmlBuilder.ts        (new)
src/components/UsageLogPrintCsvBuilder.ts         (new)
src/components/__tests__/start-usage-dialog.validation.test.tsx    (new)
src/components/__tests__/end-usage-dialog.validation.test.tsx      (new)
src/components/__tests__/usage-log-print.columns.test.tsx          (new)
src/components/__tests__/log-template.columns.test.tsx             (new)
```

## Verification gates

Theo thứ tự bắt buộc cho diff TS/TSX:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused tests của flow usage + print-template
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

Sau thay đổi DDL, chạy thêm:

- `supabase-get_advisors(type='security')`

## Trạng thái

Plan đã được nâng cấp theo review và đang chờ bạn duyệt trước khi implementation.
