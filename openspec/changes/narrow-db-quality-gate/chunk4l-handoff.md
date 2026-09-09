# Chunk 4l — Equipment ordering and model search batch

Batch gồm đúng hai entry:

- `equipment_list_enhanced_liquidation_order_smoke.sql` (Entry 14): giữ
  liquidation ordering và expected total; JWT chỉ là fixture.
- `equipment_list_enhanced_model_search_smoke.sql` (Entry 15): giữ model-only
  searchable equipment và model-search result contract; global role chỉ là
  fixture.

Cả hai là `migration-specific` business thuần, `requiredForMigrations` đang
trống theo classification và được giữ `intentional-unmapped` cho tới khi có
mapping exact. Không tạo core-security companion, không đổi SQL/registry hay
selected set 77.

Chưa chạy Oracle/live DB, chưa có aggregate DB PASS, và chưa bắt đầu Chunk 5/6.
Entry 16 sentinel false-pass và Entry 19 mixed reports vẫn ngoài scope.
