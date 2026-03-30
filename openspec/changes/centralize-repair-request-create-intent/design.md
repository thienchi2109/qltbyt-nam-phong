## Context

Luồng tạo yêu cầu sửa chữa hiện đi qua nhiều entry point khác nhau trong ứng dụng: Dashboard, Equipment desktop row actions, Equipment mobile cards, QR scanner, và AssistantPanel draft handoff. Mỗi entry point đang tự dựng deep-link sang `/repair-requests`, dẫn đến drift trong contract điều hướng. Kết quả là cùng một hành động "Báo sửa chữa" nhưng có nơi mở create sheet ngay, có nơi chỉ điều hướng sang trang, và có nơi truyền `equipmentId` nhưng không dùng cùng một trigger để mở sheet.

Sink hiện tại của flow này đã tập trung tương đối tốt ở trang Repair Requests. `useRepairRequestsDeepLink()` đọc query params, resolve `equipmentId`, gọi `openCreateSheet()`, và `RepairRequestsCreateSheet` chịu trách nhiệm hydrate thiết bị được chọn vào form. Vì vậy vấn đề chính không nằm ở chỗ thiếu một sink tập trung, mà nằm ở chỗ các source đang không dùng cùng một contract để đi vào sink đó.

Ràng buộc của thay đổi này:
- Không thay đổi schema, RPC tạo phiếu, hoặc payload submit của form.
- Không loại bỏ deep-link, vì refresh/copy URL/cross-page navigation vẫn phải hoạt động.
- Không thêm state store toàn cục chỉ để chuyển một intent điều hướng xuyên route.
- Giữ blast radius nhỏ, ưu tiên gom source trước rồi mới xử lý các lỗi resolve/prefill riêng nếu còn tồn tại.

## Goals / Non-Goals

**Goals:**
- Thiết lập một app-wide contract duy nhất cho hành động "mở form tạo yêu cầu sửa chữa".
- Buộc mọi entry point tạo yêu cầu sửa chữa dùng cùng một helper/hook thay vì tự hardcode URL.
- Giữ trang Repair Requests là single sink chịu trách nhiệm mở create sheet và áp dụng prefill theo `equipmentId`.
- Đảm bảo desktop, mobile, dashboard, và QR scanner đều kích hoạt cùng một hành vi điều hướng.
- Tạo mặt bằng test rõ ràng cho source contract và sink deep-link flow.

**Non-Goals:**
- Không thay đổi layout hoặc UX tổng thể của Repair Requests create sheet.
- Không sửa backend `equipment_get`, tenant scoping, hay các RPC liên quan trong change này.
- Không chuyển flow sang global modal manager, intercepting route, hoặc cross-route client store.
- Không redesign lại action menus/cards ở Equipment hoặc Dashboard.

## Decisions

### 1. Dùng một pure helper làm canonical contract cho create intent

Chúng ta sẽ tạo một helper thuần, ví dụ `buildRepairRequestCreateHref({ equipmentId? })`, để sinh ra deep-link canonical cho flow tạo yêu cầu sửa chữa. Contract canonical luôn bao gồm `action=create`, và thêm `equipmentId` khi caller có ngữ cảnh thiết bị.

Lý do chọn helper thuần:
- Có thể dùng ở mọi nơi: `router.push`, `Link`, tests, và các utility không nằm trong React tree.
- Dễ snapshot/test hơn một hook.
- Tránh duplication của literal string `/repair-requests?...` ở nhiều bề mặt UI.

Phương án thay thế đã cân nhắc:
- Chỉ tạo một custom hook dùng `useRouter()`: ngắn gọn ở component nhưng khó dùng với `Link`, khó test ở mức pure function, và vẫn cần logic dựng URL ở đâu đó.
- Tiếp tục hardcode URL ở từng entry point: chi phí ngắn hạn thấp nhưng chính là nguyên nhân drift hiện tại.

### 2. Giữ Repair Requests page là single sink cho open + prefill

Không chuyển logic mở sheet sang source pages. Mọi source chỉ tạo cùng một intent điều hướng, còn `useRepairRequestsDeepLink()` tiếp tục là nơi duy nhất:
- đọc `action=create`
- đọc `equipmentId`
- resolve thiết bị khi có
- gọi `openCreateSheet(equipment?)`

Lý do:
- Phù hợp với kiến trúc hiện tại; ít xâm lấn nhất.
- Deep-link vẫn hoạt động khi reload hoặc paste URL trực tiếp.
- Tránh coupling giữa Equipment/Dashboard/QR scanner với state nội bộ của Repair Requests.

Phương án thay thế đã cân nhắc:
- Mở sheet trực tiếp từ source page bằng shared global store/context: không bền qua reload, khó dùng khi navigation bắt đầu từ route khác.
- Dùng intercepting route/modal route của Next.js: sạch hơn về mặt route semantics nhưng quá nặng cho một bugfix/standardization pass.

### 3. Chuẩn hóa tất cả entry point theo cùng API, bao gồm Dashboard

Mọi source mở form tạo yêu cầu sửa chữa sẽ dùng chung API mới, không ngoại lệ:
- Equipment desktop row actions
- Equipment mobile actions/cards
- Dashboard repair actions
- QR scanner repair actions
- AssistantPanel draft handoff

Dashboard hiện đang dùng đúng deep-link contract, nhưng vẫn phải chuyển sang API chung để loại bỏ duplication và ngăn drift trong tương lai. QR scanner và Equipment mobile đang là hai source dễ lệch nhất nên phải được gom cùng thay vì vá riêng lẻ.

### 4. Đặt test ở hai lớp: source contract và sink behavior

Test sẽ được chia làm hai nhóm:
- Source contract tests: các entry point gọi cùng helper/hook và tạo cùng canonical href.
- Sink behavior tests: `useRepairRequestsDeepLink` và create sheet vẫn mở/prefill đúng khi nhận canonical href.

Lý do:
- Nếu chỉ test sink, source vẫn có thể tiếp tục drift.
- Nếu chỉ test source, lỗi mở sheet/prefill ở Repair Requests sẽ không bị chặn.

### 5. Không "che" lỗi prefill sâu bằng thay đổi contract

Việc centralize source contract sẽ sửa lỗi mobile không mở form. Tuy nhiên nếu desktop vẫn mở sheet nhưng không prefill vì `equipment_get` hoặc tenant resolution fail, đó là lỗi riêng ở sink/backend resolution path và phải được quan sát như một issue độc lập nếu còn tồn tại sau khi contract được chuẩn hóa.

Lý do:
- Giữ change này có scope rõ ràng.
- Tránh trộn "contract unification" với "equipment resolution reliability" trong cùng một pass.

## Risks / Trade-offs

- [Shared helper becomes too thin to justify itself] → Giữ helper cực nhỏ, chỉ bao bọc canonical query contract; giá trị chính là loại bỏ duplication và tạo điểm test duy nhất.
- [Contract unification fixes mobile but not all desktop prefill failures] → Ghi rõ đây là expected scope boundary; giữ regression tests cho deep-link flow và mở issue follow-up nếu sink resolution vẫn fail.
- [New helper location becomes ambiguous] → Đặt trong shared navigation-oriented module gần `src/lib` với tên bám domain để grep dễ và không phụ thuộc route-local code.
- [Future entry points bypass helper and reintroduce drift] → Thêm test + OpenSpec requirement để helper trở thành path mặc định cho mọi create-repair navigation mới.
- [Changing multiple high-traffic surfaces at once] → Giữ implementation nhỏ, không đổi UI copy, và xác minh focused trên Dashboard, Equipment desktop/mobile, QR scanner, và Repair Requests deep-link flow.
- [Potential race between `equipmentId` resolution and `action=create` handling still leaves the sheet unprefilled] → Giữ risk này ngoài scope của change hiện tại, nhưng ghi nhận làm follow-up riêng sau khi source contract được chuẩn hóa. Khi các source như mobile và QR scanner bắt đầu gửi canonical contract, race này sẽ ảnh hưởng rộng hơn nếu chưa được xử lý.

## Migration Plan

1. Introduce canonical create-intent helper/hook and add focused unit tests for href generation.
2. Refactor existing source entry points to call the shared API instead of hardcoded route strings.
3. Keep `useRepairRequestsDeepLink` compatible with the canonical contract and tighten tests around `action=create` + `equipmentId`.
4. Run focused verification for Dashboard, Equipment desktop/mobile, QR scanner, and Repair Requests deep-link tests.
5. Deploy with no backend migration.

Rollback:
- Revert the shared helper/hook adoption and restore previous call sites.
- Because no RPC or schema contract changes are involved, rollback is code-only.

## Open Questions

- Có cần expose cả pure helper và hook wrapper ngay từ đầu, hay chỉ helper là đủ cho current call sites?
- Nếu `equipment_get` không resolve được từ canonical deep-link, ta có muốn thêm user-visible telemetry/toast trong change kế tiếp không?
- Sau khi chuẩn hóa contract, có nên tách một follow-up change chuyên xử lý race condition giữa effect resolve `equipmentId` và effect `action=create` trong `useRepairRequestsDeepLink()` không?
