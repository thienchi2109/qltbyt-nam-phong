# Chunk 4h — Active repair trong equipment list

Base: `953b11d09438947e4c819c3aff58ccee805e40dd`. Chỉ entry 13.

- Core: giữ nguyên F (cross-tenant exclusion), thêm witness G kiểm tra row
  tồn tại và ID thiết bị tenant B cho global; không kiểm tra repair ID.
- Business: giữ nguyên A–E và G về active repair ID, bỏ F.
- Hai companion giữ fixture/helper JWT transaction-local và rollback độc lập.
  Test mixed gốc và registry active không đổi; selected set 77; chưa mapping
  migration hoặc kích hoạt companions.
- Regression bảo toàn toàn bộ block A–E/F/G, fixture, rollback và registration.
  Bản nháp extraction sai boundary FAIL 1/2; sửa core rồi suite 37/37 PASS.
  Đây là RED trên bản nháp, không phải test-first trước khi tạo companion.
- Format, explicit-any, dedupe, typecheck PASS. Chưa chạy SQL trên DB;
  không có aggregate DB PASS. Không bắt đầu Chunk 5/6 hay nhóm tiếp theo.

## Còn lại

- User review 4h; migration mapping/cutover và dynamic validation ở chunk sau.
