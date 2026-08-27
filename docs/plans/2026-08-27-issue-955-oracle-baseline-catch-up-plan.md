# Issue #955: Oracle Catch-up Role-safe và Recoverable

## Tóm tắt

- Xử lý **#958 trước bằng PR riêng** để khôi phục baseline test xanh. Tính đến ngày 27/08/2026, count thực tế là `phase-gate=37` và `default-safe=72`.
- #955 không tạo migration SQL và không ghi live DB. Thay đổi tập trung vào Oracle baseline maintenance, state/evidence contract và runbook.
- Thay định nghĩa `healthy + high-water` bằng state v2 có catalog parity cho các RPC `technical_configuration_*`.
- Giữ recovery đơn giản: `health` chỉ tự ghi metadata khi state đã ghi nhận chính migration SQL đó chạy thành công; không bao giờ tự chạy lại migration SQL.

## Thay đổi contract

- Thay `--confirmations` bằng `--manifest`, dùng manifest versioned gồm:
  - `schemaVersion`, `sourceCommit`, `targetMigrationHighWater`.
  - Danh sách migration với `liveVersion`, `liveName`, local path và SHA-256 chính xác.
  - Catalog các RPC `technical_configuration_*`: chữ ký đầy đủ, definition hash, owner, execution mode, `search_path` và execute grantees.
  - Catalog được sắp xếp và hash lại khi parse; không hard-code số lượng `79`.
- Nâng `baseline/current.json` lên schema v2:
  - Lưu catalog/hash cùng migration confirmations.
  - Recovery ghi migration hiện tại và phase `prepared`, `sql-applied` hoặc `metadata-recorded`.
  - State v1 vẫn được đọc cho maintenance upgrade nhưng không còn được dynamic preflight tin là healthy.
- Tách executor contract thành các thao tác độc lập: role preflight, apply một migration, ghi/read-back metadata và inspect health/catalog.

## Triển khai theo TDD

1. **Khóa contract bằng test đỏ**
   - Thêm test riêng cho manifest, role preflight, catalog parity và recovery để không làm file test hiện tại vượt trần 450 dòng.
   - Test state v1 bị fail-closed, state v2 exact mới được chấp nhận.
   - Test high-water bằng nhau nhưng catalog 75/79 vẫn `INCOMPLETE`.

2. **Role-safe catch-up**
   - Preflight trước khi publish unhealthy hoặc chạy SQL:
     - `supabase_admin` có thể `SET ROLE postgres`.
     - `postgres` có `USAGE` nhưng không có `CREATE` trên `public`.
     - `supabase_admin` có quyền ghi metadata và quản lý schema privilege.
     - Không có metadata conflict theo version/name/hash.
   - Cấp tạm `CREATE` cho `postgres`, chạy migration SQL với role `postgres` để giữ ownership tương đương live.
   - Luôn revoke trong `finally`, sau đó query xác nhận `postgres` không còn `CREATE`.
   - Sau khi SQL thành công và privilege đã sạch, atomic-publish phase `sql-applied`.
   - Ghi metadata bằng `supabase_admin`, rồi read-back và so sánh exact name cùng SQL hash trước khi chuyển phase.

3. **Health recovery**
   - Nếu metadata đã tồn tại chính xác: chỉ verify toàn bộ observation/catalog rồi publish healthy v2.
   - Nếu metadata thiếu nhưng recovery phase là `sql-applied` và migration identity/hash khớp manifest: `health` ghi metadata bằng `supabase_admin`, không chạy lại SQL.
   - Nếu state chỉ ở `prepared`, hash lệch, metadata conflict, privilege còn leak hoặc catalog không khớp: trả `INCOMPLETE`; recovery bắt buộc full-refresh.
   - `health` được phép revoke lại temporary `CREATE` nếu recovery state cho thấy lần catch-up trước bị gián đoạn.

4. **Catalog parity và full-refresh**
   - Mở rộng Oracle observation query để thu catalog RPC Technical Configurations theo chữ ký, không theo count đơn thuần.
   - Catch-up, health và full-refresh chỉ publish healthy khi migration records, structural health và catalog đều exact.
   - Full-refresh áp dụng cùng role contract trên staging database và chỉ swap sau khi catalog target khớp.
   - Dynamic preflight chỉ chấp nhận state v2 và re-query catalog; catalog trở thành một phần của `stateHash`, tự động vô hiệu hóa evidence cũ.
   - Giữ logic warning/SQL-test execution của **#967** ngoài scope.

5. **Cấu trúc và tài liệu**
   - Tách recovery/preflight helpers khỏi `baseline-maintenance.ts` trước khi file vượt ngưỡng 350 dòng.
   - Cập nhật runbook với manifest generation qua Supabase MCP read-only, role matrix, recovery decision table và cảnh báo catch-up sửa trực tiếp `qltbyt_test`.
   - Giữ `AGENTS.md` và `CLAUDE.md` đồng bộ về state v2/catalog parity.

## Kiểm thử và rollout

- Cases bắt buộc: thiếu schema `CREATE`, thiếu metadata privilege, migration fail, metadata fail sau SQL success, revoke ở mọi failure path, exact metadata hash, health không replay SQL, catalog thiếu/thừa/body-owner-ACL lệch và v1-to-v2 upgrade.
- Chạy theo thứ tự: format check, `verify:no-explicit-any`, `verify:dedupe`, typecheck, focused Vitest, toàn bộ DB Quality Gate suite sau khi #958 đã đóng, rồi React Doctor.
- Sau khi merge exact commit, tạo manifest mới từ live bằng Supabase MCP read-only.
- Oracle hiện cùng high-water `20260825121502` nhưng live có 79 RPC và Oracle chỉ có 75, nên rollout đầu tiên phải dùng **full-refresh**, không dùng health để che drift.
- Acceptance cuối: state v2 healthy, high-water bằng live hiện tại, catalog exact, `postgres` không có schema `CREATE`, `dq_* = 0`, lock count `0`, và baseline-forward PASS trên exact commit.

## Biên phạm vi

- #958 là prerequisite riêng; không gộp diff vào #955.
- #956 đã hoàn tất và #966 thuộc static analyzer, không tái sử dụng classifier đó cho catalog parity.
- #957 có thể thay đổi RPC sau này nên inventory luôn lấy động từ live manifest.
- #959 thuộc schema `realtime` do Supabase quản lý; giữ nguyên exclusion hiện tại.
- Không có live DB write, Supabase CLI hoặc thay đổi migration lịch sử trong #955.
