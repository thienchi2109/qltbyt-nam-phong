# Bàn giao Issue #998 - Task 1

## Trạng thái

- Nhánh: `fix/998-static-reviewed-selector`
- Worktree: `/root/qltbyt-nam-phong/.worktrees/issue-998`
- Base SHA: `b603e579379411a917042dd7713d833895493807`
- Implementation SHA: `9fed1fbc36fda889a37e34ba8ba5518097363341`
- Parent review: hoàn tất, không còn finding Critical hoặc Important.
- Parent verification độc lập: focused selector suites PASS `14/14` trong `3.25s`.

## Hành vi đã hoàn thành

- Thêm tùy chọn CLI `--reviewed-migration-selector`, chỉ hợp lệ với lane `static`.
- Selector phải khớp chính xác `subjectCommit`, đường dẫn migration canonical và tracked, không trùng lặp, không thoát checkout, file còn tồn tại, và SHA-256 của byte nội dung tại commit lẫn worktree.
- Migration đã được review được kiểm tra thêm bên cạnh migration thay đổi bình thường; không thay đổi cách baseline-forward chọn pending migrations.
- Report lưu `reviewedMigrationIdentities` gồm đúng path và raw-byte SHA-256, đồng thời bind toàn selector bằng `inputHashes.reviewedMigrationSelector` và report digest.
- Static bình thường khi không truyền option giữ nguyên hành vi. Selector thiếu, JSON lỗi, shape lỗi hoặc mismatch đều fail closed với `INCOMPLETE`. Dynamic lane từ chối option này.
- Explicit landed static có zero DB-gate diff vẫn kiểm tra selector hợp lệ; không tạo PASS giả và không tuyên bố migration pending.

## File triển khai chính

- `scripts/db-quality-gate/static-candidate-evidence.ts`
- `scripts/db-quality-gate/static-lane.ts`
- `scripts/db-quality-gate/landed-static-lane.ts`
- `scripts/db-quality-gate/cli.ts`
- `scripts/db-quality-gate/static-lane-types.ts`
- `scripts/db-quality-gate/static-lane-report.ts`
- `scripts/db-quality-gate/types.ts`
- `scripts/db-quality-gate/contract.ts`
- `scripts/db-quality-gate/pre-live-report.ts`
- `scripts/__tests__/database-quality-gate-static-lane-evidence.test.ts`
- `scripts/__tests__/database-quality-gate-reviewed-selector.test.ts`

## Bằng chứng TDD và kiểm tra

- Không có log RED đáng tin cậy từ phần test/implementation mà agent trước để lại, nên không ghi nhận RED cho phần đó.
- RED đã quan sát cho report evidence: focused suite có `12` tests, `1` failure đúng nguyên nhân thiếu `reviewedMigrationIdentities`, `11` tests còn lại PASS.
- GREEN sau minimal wiring: `12/12` PASS.
- Focused cuối: `2` files, `14/14` PASS.
- Compatibility bounded: `6` files, `30/30` PASS, gồm static CLI, gate contract, pre-live producer/parser và selector evidence.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`: PASS.
- React Doctor changed scope: `100/100`, không có issue.
- Commit hooks: PASS. Local DB quality gate trả `SKIP` vì không đổi SQL, migration hoặc gate registry; đây không phải DB gate PASS và không có baseline-forward evidence trong Task 1.

## Ranh giới và bước tiếp theo

- Không có thao tác live DB, Supabase MCP write, Supabase CLI, Oracle test DB hoặc baseline-forward trong Task 1.
- Hiện chưa có ủy quyền cho bất kỳ thao tác live DB hoặc Oracle test DB nào. Mọi thao tác như vậy về sau phải được người dùng cho phép rõ ràng, riêng cho đúng operation trước khi chạy.
- Task 2, Task 3 và Task 4 vẫn pending. Mục `2.4` vẫn unchecked. Issue #998 vẫn mở.
- Chưa merge hoặc thay đổi `main`. Bước kế tiếp chỉ là Task 2 sau khi người dùng duyệt rõ ràng.
