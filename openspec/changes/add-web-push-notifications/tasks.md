# Web Push Go Service - Phased Implementation Plan

**Goal:** Thêm Web Push theo tài khoản, song song và bảo toàn ZBS theo số điện thoại.

**Architecture:** QLTBYT/Supabase sở hữu auth, subscription và outbox; Go Docker trên Oracle chủ động claim/report HTTPS và gửi Web Push. Không database/queue riêng cho Go.

**Spec:** [requirements](specs/notifications/spec.md), [design](design.md), [scope](proposal.md).

## Quy tắc thực thi và review

- Mọi checkbox để trống cho đến khi có bằng chứng. Phase 1 là contract/baseline; hoàn thành artifacts Phase 1 không có nghĩa các phase runtime/deploy đã được thực hiện.
- Mỗi phase là một đơn vị review và landing riêng. Chỉ thực hiện phase được maintainer giao, báo kết quả rồi dừng; không tự nhảy sang phase sau hoặc live deploy.
- Dependency: 1 -> 2; 3 và 4 cần 2; 5 cần 3+4 và public key/version test từ 4; 6 cần 1 và contract 4; 7 cần 5+6; 8 cần 7. Không gộp DB + UI + worker + production trong một PR.
- Phase có SQL phải giữ migration immutable, chạy static và Oracle baseline-forward trên disposable DB cùng exact landed commit. Report hai lane riêng; live apply cần quyền cụ thể qua Supabase MCP.
- Phase TS/TSX chạy format -> no-explicit-any -> diff-only dedupe -> typecheck -> focused tests -> React Doctor. Semantic reuse check khi thêm logic dùng chung; không full-suite/full-dedupe mặc định.
- Phase Go có runnable checks cho claim/report errors, provider responses, crash recovery, SSRF và payload; chọn thư viện Web Push bảo trì tốt thay vì tự viết crypto.
- Đổi scope hoặc phát hiện blocker thì báo trong handoff, không âm thầm thêm phase. Không sửa ZBS artifacts, credentials hoặc hành vi trong change này.

## Phase 1 - Chốt contract kỹ thuật và regression baseline

**Boundary:** artifacts/contract fixtures và tests bảo vệ hành vi; chưa runtime, SQL, UI hay deploy. Đọc `src/auth`, RPC claims, ZBS enqueue/dispatcher, DQSS client và deep-link helper.
**Deliverable:** contract một phiên bản đủ để QLTBYT và Go implement độc lập; không dựng scaffolding rỗng.

- [x] 1.1 Ghi source/build location Go, tên bảng/RPC/endpoints, request/response/version, signed request/replay/rotation contract; chốt owner vận hành VAPID, fingerprint/version, bàn giao public key và controlled rotation/resubscribe; không tạo external repo hoặc provision VM trong phase này.
- [x] 1.2 Pin lease/batch/poll/backoff/body limits, payload byte budget và retention, đáp ứng mục tiêu 60 giây và deadline 24 giờ; ghi error/status mapping, ownership/revocation và retry contract.
- [x] 1.3 Khóa regression có giá trị: ZBS enqueue mọi priority, đúng tenant/phone, không recipient, rollback, delivery failure isolation; ghi baseline thực tế và scope code sẽ chạm; pin recipient authorization truth table từ profile/read/tenant guards mới nhất, semantics current_don_vi và account eligibility (không giả định nhan_vien.active).
- [x] 1.4 Review contract đối chiếu mọi requirement; xác nhận không mở lại chính sách đã chốt, ghi bằng chứng baseline và dừng.

**Evidence:** [contract v1](phase-1-contract.md), [source/mock baseline, review và giới hạn](phase-1-evidence.md), runnable `node openspec/changes/add-web-push-notifications/phase-1-baseline.check.mjs`. Tick Phase 1 không chứng nhận DB rollback/browser/live: source check PASS; baseline hiện hữu 75 pass/1 QR adoption fail, theo dõi #997; memory ID yêu cầu không có trong agentmemory hiện tại.

**Exit / rollback:** contract được review, checks phản ánh hành vi ZBS hiện tại. Không có production behavior để rollback.

## Phase 2 - Schema và RPC quản lý Web Push, chưa enqueue

**Dependency:** 1. **Boundary:** forward-only additive SQL + SQL tests cho config/subscription/delivery state; không sửa create flow, không API/UI/Go. Target `supabase/migrations` và test registry đúng scope.

- [ ] 2.1 Thêm schema Web Push riêng với recipient user IDs, subscription unique ownership/revision và VAPID key version, logical intent và per-subscription delivery/lease/deadline constraints; cấm client table access trực tiếp.
- [ ] 2.2 Thêm RPC cấu hình và register/revoke có claims/scope, validation atomic username list, invalid-profile/unknown/unauthorized rejection và admin/global parity; thêm server-internal subject predicate đọc recipient profile từ DB, tenant-level check cho config và request-specific check cho enqueue/dispatch, không dùng worker JWT làm recipient.
- [ ] 2.3 Test tenant tampering, account switch, duplicate endpoint, username trim/dedupe, invalid list không partial save và revoke idempotency; test subject/read parity cho admin/global, regional_leader, to_qltb đổi current_don_vi, user khoa/phòng rỗng/khác, subject bị xóa/role không hợp lệ và worker identity đặc quyền.
- [ ] 2.4 Chạy hai DB lanes cùng commit, review grants/RLS/source ordering và lưu evidence; chưa live apply nếu chưa được phép.

**Exit / rollback:** schema/RPC kiểm chứng trên disposable DB; additive deploy không tự phát sinh event. Rollback bằng giữ entrypoint chưa kết nối, không DROP để mất dữ liệu.

## Phase 3 - Atomic enqueue song song ZBS

**Dependency:** 2. **Boundary:** SQL create-flow và regression tests; không worker/UI/provider. Chạm định nghĩa mới nhất của `repair_request_create`, không sửa migration đã applied.

- [ ] 3.1 Thêm enqueue Web Push có control mặc định tắt, snapshot đúng tenant/recipient/content và logical uniqueness; giữ nguyên khối ZBS, audit và equipment-state behavior.
- [ ] 3.2 Test commit/rollback, mọi priority, không recipient, no cross-tenant fallback, không backfill recipient mới và controls không ảnh hưởng ZBS.
- [ ] 3.3 Chứng minh không outbound HTTP trong transaction; ghi rõ DB failure rollback khác với delivery failure sau commit.
- [ ] 3.4 Chạy hai DB lanes cùng commit, đối chiếu ZBS regression và dừng trước live review.

**Exit / rollback:** enqueue tắt khi landing/deploy; bật thử chỉ disposable fixture. Tắt control Web Push để quay lại hành vi cũ, không reset/delete outbox.

## Phase 4 - Backend QLTBYT và worker claim/report

**Dependency:** 2. **Boundary:** server endpoints + RPC claim/report và tests; không browser UI, không Go send. Dùng session/claims hiện có và signed internal request pattern riêng Web Push.

- [ ] 4.1 Expose configuration/registration/revoke server routes đúng quyền, không tin client identity, input limits/CSRF-origin protection và lỗi an toàn.
- [ ] 4.2 Implement claim/fan-out/report có lease fencing, deadline, recheck quyền/config/ownership và per-subscription completion; giữ intent chưa có subscription trong hạn.
- [ ] 4.3 Implement private worker authentication, replay rejection, bounded requests và separate controls; endpoint disabled phản hồi để worker backoff, revoke vẫn hoạt động; cung cấp public key/version test riêng của môi trường qua cấu hình app, reject registration dùng version không hỗ trợ.
- [ ] 4.4 Test concurrency/reclaim/stale report, removed recipient, account inactive/mất quyền, successful endpoint không resend vì endpoint khác lỗi và SSRF input boundary.
- [ ] 4.5 Chạy TS gates và DB lanes nếu có SQL, review contract compatibility; deploy mặc định tắt và dừng.

**Exit / rollback:** fake worker chạy contract trên môi trường disposable; không gửi provider. Tắt controls/rollback server release tương thích schema additive.

## Phase 5 - UI cấu hình, opt-in và service worker

**Dependency:** 3+4, gồm public key/version test được Phase 4 cung cấp; không cần Go chạy. **Boundary:** QLTBYT UI/browser lifecycle và tests; không Go/Oracle deploy. Tái sử dụng RBAC, signout và repair deep link hiện có; không khôi phục Firebase scaffold.

- [ ] 5.1 Thêm UI cấu hình theo đơn vị cho global/admin/to_qltb, comma-separated username list, atomic errors và trạng thái không có recipient.
- [ ] 5.2 Thêm bật/tắt thông báo tự nguyện trong app, preview nội dung màn hình khóa, permission/unsupported/blocked states và hướng dẫn Home Screen iOS/iPadOS; dùng public key/version từ Phase 4 và hiển thị yêu cầu đăng ký lại khi key version thay đổi.
- [ ] 5.3 Tái sử dụng public/manifest.json, metadata src/app/layout.tsx, Serwist next.config.ts/src/sw.ts và registration /sw.js trong pwa-install-prompt; kiểm kê/bổ sung icons/start_url/scope/display standalone/HTTPS để cài Home Screen được, không đăng ký worker thứ hai cùng scope; không thêm offline/auth-data cache. Thêm service worker push/click, safe payload rendering, Unicode-safe truncation/tag, foreground không double-display và deep link qua login/quyền.
- [ ] 5.4 Gắn revoke vào disable/logout/account switch; test offline cleanup không chặn logout vô hạn, multi-browser độc lập và không tự đổi owner.
- [ ] 5.5 Chạy TS gates, user-event tests và browser checks có fake push; registration mặc định tắt, chưa production send.

**Exit / rollback:** UI/worker không phụ thuộc Firebase, không đổi ZBS. Tắt registration UI nhưng giữ revoke; rollback worker theo version đã kiểm thử.

## Phase 6 - Go worker và Docker artifact, chưa production send

**Dependency:** 1 + wire contract 4. **Boundary:** source Go/build/tests/runbook trong location phase 1; mock QLTBYT/provider. Không Supabase credentials/SQL, không live Oracle mutation.

- [ ] 6.1 Implement poll/claim/send/report loop có timeout, backoff và graceful shutdown; dùng Web Push library, VAPID private key qua secret; readiness kiểm tra derived public key/fingerprint khớp app contract Phase 4, mismatch không claim/send; không durable queue/database.
- [ ] 6.2 Validate outbound HTTPS endpoint và resolved addresses, chặn private/link-local/redirect bypass; bound payload/TTL và map 404/410/429/5xx/config errors đúng contract.
- [ ] 6.3 Test provider accepted/report lost, worker crash/reclaim, stale lease, deadline và từng subscription; không báo accepted thành delivered/read.
- [ ] 6.4 Tạo Docker image, private health/readiness, minimal metrics/log redaction và VAPID persistence/controlled rotation/resubscribe/rollback runbook cho Oracle, không regenerate key khi restart; mặc định paused.
- [ ] 6.5 Chạy Go checks/container smoke trên mocks, xác nhận image không chứa secrets, review artifact và dừng.

**Exit / rollback:** artifact chạy được trên mocks, không gửi thật. Rollback image hoặc pause worker, không mất queue vì state ở Supabase.

## Phase 7 - Tích hợp staging và browser matrix

**Dependency:** 5+6. **Boundary:** disposable/staging end-to-end, tài khoản và thiết bị test đồng ý nhận; không production enable. Nếu cần ghi/deploy môi trường ngoài phải có quyền đúng scope.

- [ ] 7.1 Chứng minh create -> independent outboxes -> authenticated Oracle-style worker -> provider acceptance, đo target 60 giây khi khỏe và TTL <= remaining 24 giờ.
- [ ] 7.2 Fault injection backend/Go/provider outage, partial delivery, credential failure, logout/revocation, concurrent workers và expired backlog; đọc lại state làm evidence.
- [ ] 7.3 Kiểm chứng Chrome/Edge desktop, Android Chrome/Edge, Firefox desktop, iOS/iPadOS: thêm Home Screen từ app, mở installed standalone, xác nhận manifest/scope/registration rồi user-gesture opt-in, foreground/background, click/login, payload dài, logout/account switch; ghi OS/browser/version, thiếu thiết bị thì incomplete.
- [ ] 7.4 Chạy ZBS regressions và đối chiếu cùng request không bị đổi phone recipient, enqueue count, retry state; Web Push disable không ảnh hưởng ZBS.
- [ ] 7.5 Review kết quả và runbook enable/pause/rollback/retention, xác nhận toàn bộ gates hoặc blockers trước production review.

**Exit / rollback:** evidence đầy đủ browser và recovery; dọn dữ liệu test đúng scope, giữ production off. Không dùng staging PASS làm quyền live write.

## Phase 8 - Oracle production rollout có canary

**Dependency:** 7. **Boundary:** vận hành được maintainer cho phép; không mở rộng feature hoặc sửa ZBS/test DB infrastructure.

- [ ] 8.1 Kiểm tra read-only live drift, exact-commit DB evidence và compatibility; xin quyền cụ thể trước từng live migration qua Supabase MCP, apply rồi read-back.
- [ ] 8.2 Deploy Go image trên Docker Oracle với network/secrets riêng, private health, HTTPS outbound QLTBYT/providers; xác minh không có Supabase service-role key và không mở cổng container công khai. Owner vận hành provision cặp VAPID production bền vững và bàn giao chỉ public key/version cho app, kiểm tra khớp trước bật registration. Worker vẫn paused.
- [ ] 8.3 Deploy QLTBYT tương thích; bật registration cho canary đã đồng ý, cấu hình user đúng tenant, rồi enqueue/dispatch theo controls; ghi provider acceptance và kiểm tra thực tế trên thiết bị.
- [ ] 8.4 Quan sát backlog/error/expiry, xác nhận ZBS vẫn hoạt động độc lập; diễn tập pause/resume giữ deadline, chỉ mở rộng sau maintainer review canary.
- [ ] 8.5 Hoàn tất handoff phiên bản app/image, cấu hình không chứa secret, rollback, key rotation, retention và evidence; chỉ tick mục đã có bằng chứng, không archive khi còn acceptance incomplete.

**Exit / rollback:** canary và mở rộng được duyệt, health/read-back rõ ràng. Tắt Web Push dispatch/enqueue/registration, giữ revoke và state để điều tra; không rollback destructive schema hoặc thay đổi ZBS.
