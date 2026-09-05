# Đối chiếu SQL live với source bất biến

## Trường hợp #987, xác minh ngày 2026-09-05

Migration version `20260831141415` có tên live
`20260831120000_device_quota_regulatory_catalog_foundation`.
Source bất biến là
`supabase/migrations/20260831120000_device_quota_regulatory_catalog_foundation.sql`.

- SHA-256 source: `eba9dad8b8ec092405ed6beb2ff2e8c6e32123f1a7e541c205798c721fcba780`.
- SHA-256 `statements[1]` live: `da4ebe2c8b596c8078adbb6e80bf674349dcc6b1d88370989ab46281f392c746`.
- Bản SQL live thu qua Supabase MCP được lưu tại
  `supabase/db-quality-gate-live-sql/20260831141415.sql`.
  Đây là evidence phục hồi, không phải migration mới.

Đối chiếu token xác định các khác biệt: comment và định dạng; live gộp
8 lệnh REVOKE cùng quyền/role thành một lệnh; source thêm `::DATE` cho hai
literal ngày chèn vào cột DATE; source viết rõ `AS` ở các alias.
Các token còn lại, bao gồm seed, khớp theo thứ tự. Không dùng chuẩn hóa token
làm thuật toán tự động chấp nhận migration khác hash.

## Hợp đồng

Mapping trong `scripts/db-quality-gate/live-sql-identity.ts` ràng buộc đồng thời
version live, name live, path source và hash source. Manifest vẫn giữ `sha256`
của source để xác định migration pending bằng path + hash. Observation và
metadata phải khớp hash SQL live theo mapping đã review.

Maintenance đọc cả source và SQL live lưu trữ từ cùng exact commit, xác minh
cả hai hash trước khi thực thi. Khi cần catch-up, chạy chính SQL live lưu trữ
và ghi chính nội dung đó vào metadata Oracle. Không gắn hash live vào SQL
source khác byte. Mapping không cấp quyền ghi live, không bỏ assertion SQL,
không sửa migration đã apply và không chấp nhận cặp hash chưa review.

Baseline cũ ghi SQL source thay SQL live phải được full refresh qua staging
theo runbook Oracle. Không sửa riêng metadata để giả vờ đã phục hồi.
Sau refresh, đối chiếu quyền/schema trong phạm vi gate rồi chạy lại static
và baseline-forward trên cùng exact commit. Candidate chỉ chạy trên DB disposable.
