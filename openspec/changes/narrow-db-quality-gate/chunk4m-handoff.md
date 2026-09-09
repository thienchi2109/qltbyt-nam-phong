# Chunk 4m — Migration-specific integrity batch

Batch gồm đúng ba entry:

- Entry 22 `maintenance_audit_notfound_smoke.sql`: historical audit/not-found
  business contract.
- Entry 28 `repair_request_equipment_status_invariant_smoke.sql`: repair
  request equipment-status invariant.
- Entry 34 `technical_configuration_baseline_cross_dossier_copy_phase_gate.sql`:
  cross-dossier copy phase-gate business/integrity contract.

Đối chiếu SQL thực tế cho thấy cả ba là `migration-specific` thuần; không có
core-security assertion cần tách. Giữ nguyên test, không tạo companion, không
backfill `requiredForMigrations`, không đổi SQL/registry/selected set 77.

Chưa chạy Oracle/live DB, chưa có aggregate DB PASS, và chưa bắt đầu Chunk 5/6.
Entry 16 và Entry 19 vẫn ngoài scope.
