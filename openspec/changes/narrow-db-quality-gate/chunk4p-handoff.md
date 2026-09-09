# Chunk 4p — Entry 26 active request for equipment

Chỉ xử lý `repair_request_active_for_equipment_smoke.sql`.

- Core giữ nguyên scenario 2/4/5: soft-delete exclusion, cross-tenant denial
  bằng kết quả rỗng và global cross-tenant allow. Thêm JWT setup trước scenario 2
  vì setup cũ nằm trong scenario 1.
- Business giữ nguyên scenario 1/3/6: completed-only, newest active request,
  tie-break `id DESC`; block `DECLARE/BEGIN/END` của scenario 6 giữ nguyên.
- Hai companion giữ nguyên fixture và helper transaction-local, mỗi file có
  transaction và rollback độc lập. Không sửa SQL gốc hay active registry;
  selected set vẫn 77 và companions chưa active, chưa backfill mapping.
- Regression kiểm tra nguyên block của cả sáu scenario, không lẫn scenario,
  JWT setup, rollback parser và fixture registry staging: 2/2 PASS.
  Đây là kiểm tra sau extraction, không phải bằng chứng test-first RED.
- Parser của harness kiểm tra rollback/source contract, không phải trình biên
  dịch PL/pgSQL. Chưa chạy SQL trên Oracle/live DB; không có dynamic hay
  aggregate DB PASS.

Entry 29/31 chưa triển khai. Chunk 5/6/7 chưa bắt đầu; các vấn đề Entry 21/23
từ lượt trước nằm ngoài batch này.
