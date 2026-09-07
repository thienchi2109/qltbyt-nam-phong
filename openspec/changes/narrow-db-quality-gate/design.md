# Design: Thu hẹp selector của DB Quality Gate

## Bối cảnh

`add-database-quality-gate` đã định nghĩa registry-selected SQL tests, static
lane, baseline-forward lane, exact landed-commit evidence và các lớp expected
state. Base contract vẫn yêu cầu chỉ execute SQL test khi committed metadata
cho phép requested lane và phải đưa kết quả test đã execute vào gate evidence.
Contract mới chỉ thay đổi cách chọn test `default-safe`. Nó không thay đổi
safety, transaction, fixture, rollback, evidence, hay live-authorization
contract.

Mục tiêu là giảm phạm vi business được chạy cho từng migration mà vẫn giữ lớp
bảo vệ security và migration integrity. Metadata phải giải thích được vì sao
một test được chọn; selector không được tự đoán từ nội dung SQL.

## Bất biến được giữ nguyên

1. **Exact identity:** `subjectCommit` là landed SHA mà gate đang chứng nhận.
   Pending set được xác định từ canonical migration path, path/SHA identity và
   applied lock tại commit đó.
2. **Applied history:** `supabase/applied-migrations.lock.json` và mọi applied
   migration record là append-only. Selector không thể làm một migration đã
   applied trở thành pending hoặc ngược lại.
3. **Hai lane fail-closed:** static certification và baseline-forward dynamic
   validation vẫn là hai lane độc lập. Aggregate PASS chỉ tồn tại khi cả hai
   lane PASS trên cùng exact commit và evidence invalidation keys vẫn khớp.
4. **Live authorization:** gate PASS chỉ cho phép bắt đầu quy trình xin phép.
   Live write phải có authorization affirmative cho exact target/operation trong
   session hiện tại và đi qua Supabase MCP.
5. **Baseline contract:** baseline preflight, health, high-water, structural
   checks, catalog parity và full normalized `technical_configuration_*` parity
   vẫn chạy như contract hiện hành. Candidate chỉ được chạy trên disposable
   clone của restored baseline.
6. **Evidence completeness:** selected, attempted, executed và reported test
   paths phải đối chiếu được. Thiếu input, mismatch giữa hai lane, executor,
   read-back hoặc cleanup đáng tin cậy là `INCOMPLETE`.

Baseline repair, catch-up và refresh là operations follow-up. Nếu baseline
không khỏe hoặc parity chưa chứng minh được, gate giữ `INCOMPLETE`; selector
không tự chữa baseline và không dùng thin-trust cache mới để che thiếu evidence.

## Ranh giới publication/archive

Archive/publication của delta này chỉ là boundary của tài liệu. Trước khi
archive, điều phối viên phải kiểm tra canonical capability
`database-quality-gate` đã chứa base requirement `Registry-selected SQL-test
execution`, gồm contract committed metadata cho phép requested lane và kết quả
test đã execute trong evidence. Delta phải được reconcile/rebase theo canonical
spec rồi chạy `openspec validate narrow-db-quality-gate --strict` và
`openspec show narrow-db-quality-gate --json --deltas-only`. Nếu base requirement
chưa có, phải STOP archive và yêu cầu một change canonicalization riêng. Đây
không phải điều kiện closeout/archive của change cũ để bắt đầu Chunk 6; không tự
archive change cũ, không tạo runtime gate mới và không thay đổi Chunks 2–7.

## Mô hình scope và safety

`safety` trả lời câu hỏi “test có được phép chạy trong lane nào”; `gateScope`
trả lời câu hỏi “test thuộc contract nào”. Hai field độc lập.

`safety` vẫn chỉ có ba giá trị hiện hành: `default-safe`, `opt-in` và
`live-only`. Field `purpose` và validation hiện hành cũng tiếp tục được áp
dụng: `performance`, `concurrency` và `live-acceptance` không được đăng ký với
`default-safe`. `gateScope` không thể nâng một test có safety hoặc purpose bị
loại thành test chạy mặc định.

| Safety         | `gateScope`          | Purpose/safety constraint            | Default lane sau cutover                                 |
| -------------- | -------------------- | ------------------------------------ | -------------------------------------------------------- |
| `default-safe` | `core-security`      | Purpose phải hợp lệ cho default-safe | Luôn chọn                                                |
| `default-safe` | `migration-specific` | Purpose phải hợp lệ cho default-safe | Chọn khi `requiredForMigrations` khớp exact pending path |
| `opt-in`       | bất kỳ scope hợp lệ  | Giữ safety hiện hành                 | Không chọn                                               |
| `live-only`    | bất kỳ scope hợp lệ  | Giữ safety hiện hành                 | Không chọn                                               |

Các test `opt-in` và `live-only` giữ nguyên nghĩa và đường chạy hiện tại. Không
được đổi `safety` của test business chỉ để làm selector xanh hoặc giảm thời
gian.

`core-security` chỉ bao gồm assertion về:

- RPC authorization và migration integrity;
- JWT role/user claims và tenant matching/isolation;
- tenant mismatch/violation;
- ACL của `public`, `anon`, `authenticated`;
- `search_path` và các guard liên quan đến routine security.

`migration-specific` bao gồm workflow business, phase gate và smoke contract
chỉ có ý nghĩa khi migration path tương ứng đang pending. Nếu một test chứa cả
security và business assertion, assertion security phải được nhận diện và tách
thành coverage core trước khi selector loại business portion. Trong giai đoạn
chuẩn bị, test trộn được giữ trong core selection để không mất security
coverage.

## Selector tương lai

Selector thuần nhận các input sau:

- exact `subjectCommit`;
- canonical pending migration identities, gồm path và SHA;
- registry entries đã validate;
- `requiredForMigrations` exact paths;
- selector contract version và các hash evidence hiện có.

Với default lane, selector thực hiện theo thứ tự:

1. Validate registry và pending identities. Default-safe thiếu `gateScope`, có
   scope không hợp lệ, hoặc khai báo migration path không tồn tại trong
   canonical subject commit là lỗi blocking. Historical migration-specific
   entry có mapping trống/không có chỉ được giữ ngoài default lane khi Chunk 2
   đã ghi rõ rationale; thiếu phân loại/rationale là blocking review.
2. Chọn mọi `default-safe` `core-security`.
3. Với mỗi `default-safe` `migration-specific`, chọn nếu có ít nhất một
   `requiredForMigrations` entry bằng chính xác một pending canonical path.
   Path comparison là exact normalized repository path; không glob, substring,
   timestamp, category, tên file, hoặc SQL parsing.
4. Loại `opt-in` và `live-only` khỏi default selection, đồng thời giữ metadata
   và lý do loại trong evidence.
5. Kiểm tra mọi selected `default-safe` test có đầy đủ và hợp lệ source/runner,
   transaction, fixture, timeout và cleanup contract trước khi execution bắt
   đầu. Thiếu hoặc sai contract là blocking.
6. Trả selected paths theo thứ tự ổn định cùng source SHA và selection reason.

Một required migration-specific test thất bại là failure của required contract;
baseline debt hoặc waiver cho finding khác không được hạ nó thành warning hay
bỏ qua. Historical migration-specific entry có `requiredForMigrations` trống
hoặc không khớp pending exact được giữ ngoài default lane nếu inventory đã ghi
rationale; điều này không tự động yêu cầu backfill. Ngược lại, mọi path được
khai báo trong `requiredForMigrations` phải tồn tại trong canonical migration
source tại exact `subjectCommit`; path không hợp lệ là blocking. Mỗi migration
business mới trong approved plan phải có ít nhất một relevant
`requiredForMigrations` contract exact đã review; thiếu coverage chặn review của
migration đó. Selector không được suy luận coverage từ SQL, tên file hoặc
category.

## Đồng nhất static và baseline-forward

Hai lane dùng cùng pending-path resolver và cùng selector contract version. Với
cùng `subjectCommit`, lock, registry, migration path/SHA và baseline identity,
selected set phải giống hệt nhau:

- **Static:** chạy offline, certify metadata, source hash, runner/transaction/
  fixture/rollback contract và selected-set evidence. Static không SSH, không
  đọc live DB, và không giả lập dynamic PASS.
- **Baseline-forward:** trên disposable Oracle clone, chạy đúng selected set
  sau khi baseline preflight và full parity checks hoàn tất. Persistent
  `qltbyt_test` không nhận candidate SQL.

Changed-files list không được dùng làm fallback cho pending set khi manifest
hoặc identity input thiếu. Nếu static và dynamic chọn khác nhau hoặc selected
test không có attempted/executed evidence, kết quả là `INCOMPLETE`.

Cutover phải nối cả hai lane trong cùng Chunk 6. Các chunk 3–5 có thể chuẩn bị
metadata, assertion và selector nhưng không được đổi selected behavior.

## Bảo toàn expected state và baseline

Scope reduction chỉ áp dụng cho SQL-test selection. Các lớp sau vẫn nằm trong
baseline preflight/certification:

- migration high-water và applied lock identity;
- portable application structure;
- access/security fingerprint gồm owner, grants, RLS, policies và routine
  security;
- environment compatibility;
- normalized full Technical Configuration catalog parity;
- absence/handling của temporary `postgres` schema `CREATE` theo contract hiện
  hành;
- unresolved historical invariants được báo cáo như debt, không xóa để làm
  selector PASS.

Nếu baseline cần repair, operator thực hiện operation đã được phê duyệt và
ghi evidence riêng. Gate chờ baseline health/parity hợp lệ rồi mới chạy lại;
không gộp repair vào candidate migration hoặc selector.

## Registry và mixed-test transition

Chunk 2 lập bảng phân loại theo batch tối đa 20 test tại exact commit. Bảng là
input review, không phải registry runtime. Mọi `default-safe` phải có scope và
rationale trước khi cutover; entry chưa phân loại là blocking, không bị bỏ
ngầm. Với migration-specific test lịch sử có `requiredForMigrations` trống
hoặc không có, inventory ghi rõ đây là mapping cố ý chưa gắn, rationale và việc
giữ ngoài default lane; không yêu cầu backfill lịch sử. Path không rỗng đã khai
báo nhưng không tồn tại canonical ở `subjectCommit` là blocking. Mỗi migration
business mới trong approved plan phải có relevant exact mapping đã review; thiếu
mapping chặn review migration mới.

Chunk 3 ghi metadata tương thích nhưng giữ selector cũ chạy toàn bộ
`default-safe`, để không thay đổi behavior khi metadata còn đang được review.
Chunk 4 tách security assertion khỏi mixed test và giữ business assertion trong
test migration-specific với safety contract cũ. Chunk 5 thêm selector pure và
unit tests nhưng chưa wire vào lane. Chunk 6 mới bật selector cho cả static và
dynamic. Chunk 7 chạy acceptance trên disposable infrastructure.

## Quyết định và lựa chọn bị loại

- Chạy cả 77 test `default-safe` mỗi lần giữ diff nhỏ nhưng tiếp tục trả chi phí
  và false positive business.
- Đổi toàn bộ business test thành `opt-in` làm sai ý nghĩa safety và có thể mất
  coverage migration.
- Dùng parser hoặc heuristic SQL để suy luận business/security tạo coupling
  khó kiểm chứng.
- Cache mỏng hoặc waiver mới có thể che missing evidence, trái với fail-closed
  contract.

Lựa chọn được đề xuất là metadata `gateScope` cộng với exact
`requiredForMigrations`, dùng chung cho hai lane và cutover đồng thời.

## Evidence và acceptance

Mỗi lane phải ghi subject commit, pending path/SHA set, registry/lock hashes,
selected/attempted/executed paths, baseline identity, Technical Configuration
parity result, outcome và report digest. Dynamic report còn phải ghi disposable
database identity và cleanup evidence. Static report chỉ là offline
certification; không được dùng thay Oracle evidence.

Acceptance cuối cùng cần chứng minh các trường hợp: core security luôn được
chọn; migration-specific chỉ được chọn khi path khớp exact; mapping lịch sử cố
ý để trống vẫn nằm ngoài default lane mà không ép backfill; path đã khai báo
nhưng không hợp lệ là blocking; migration business mới thiếu relevant mapping
đã review thì chặn review; migration không có business mapping không kéo cả
corpus business vào. Mọi acceptance dynamic chạy trên disposable clone và
không tạo live write.
