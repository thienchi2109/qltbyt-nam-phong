# Phase 1 evidence và handoff

Ngày 2026-09-10; source pin `05f5cf5f5fe1b1daa0a70257dd8a0817344848b1`; chỉ artifacts/tests. [Contract v1](phase-1-contract.md) là deliverable 1.1/1.2; bảng authorization ở §5 và regression dưới đây là deliverable 1.3. Không có runtime/SQL/UI, live write, Oracle deploy hoặc Phase 2 trong diff.

## Recall và khảo sát

Đã gọi agentmemory recall theo `mem_mtvn9f1m_13001642ee85`, smart search theo ID/`web push`, recall `add-web-push-notifications`; không tìm thấy đúng entry. Lần cuối export chỉ lọc ID và keywords `VAPID`/`add-web-push`/`dedicated Go Web Push`, cũng không có. Không tuyên bố đã đọc memory này, không dùng memory ZBS cũ thay quyết định Web Push. Dùng proposal/design/spec/tasks đã commit làm quyết định canonical; retrieval thiếu là giới hạn evidence cần báo maintainer, không tự mở lại chính sách.

Đã khảo sát source định nghĩa function theo filename migration (gồm thư mục lịch sử), không dựa vào ngày sửa file hoặc grep hit đầu tiên:

| Source                                                                                                               | Kết luận có bằng chứng                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/auth/config.ts`, `src/auth/{types,next-auth-callbacks,server-claims,session-profile-refresh}.ts`                | NextAuth Credentials/nhan_vien; refresh profile hiện hành; resolved current/home tenant; password invalidation; legacy fallback giữ department/region cũ |
| `src/app/api/rpc/[fn]/{route,rpc-session-claims,allowed-functions}.ts`                                               | admin→global, manager current tenant, expert chỉ module allowlist; worker không được mượn quyền này cho recipient                                        |
| `supabase/migrations/20260824070104_add_session_authorization_profile_for_jwt_rpc.sql`                               | 8 roles supported, không account active boolean guard; subject/profile hiện hành, coalesce region                                                        |
| `supabase/migrations/20260428132000_fix_repair_request_read_scope.sql`                                               | request join thiết bị, global bypass, tenant helper, user department fail-closed; không tự thêm equipment soft-delete filter vào get                     |
| `supabase/migrations/2025-10-04/20251004071000_fix_jwt_claim_reading_with_fallback.sql`                              | Regional active tenants trong region, non-regional single tenant; expert không supported bởi helper                                                      |
| `supabase/migrations/20260515113000_reassert_department_scope_unicode_aliases.sql`                                   | Latest normalized department NFC/whitespace/hyphen/CT alias                                                                                              |
| `supabase/migrations/2025-10-04/20251004063000_fix_variable_column_conflict.sql`                                     | Username lower(trim), login tenant/region guards khác refresh/read; không gọi password auth để kiểm background                                           |
| `supabase/migrations/20260630100000_add_zbs_recipient_config_and_outbox.sql`                                         | Latest create RPC; ZBS INSERT SELECT phone/config đúng tenant thiết bị, không priority parameter/filter; audit/status/history trước enqueue              |
| `supabase/migrations/20260630103000_disable_legacy_repair_request_push_trigger.sql`                                  | Tắt Firebase repair trigger cũ; không bật lại                                                                                                            |
| `src/lib/zbs/{dispatcher,live-dispatcher,internal-rpc-signature}.ts` và tests                                        | Dispatch riêng sau commit; per-row failure, lease fencing và success persistence; HMAC hiện có không đủ wire/replay Web Push                             |
| `src/app/api/device-quota/mapping/suggest/suggestion-vm-client.ts`                                                   | QLTBYT gọi VM `/suggest` bằng Cloudflare Access/internal token, timeout 8 giây; chiều ngược Web Push, không phải HMAC runtime                            |
| `src/lib/repair-request-deep-link.ts`, repair `useRepairRequestsDeepLinkView.ts`                                     | Existing view/action/requestId contract, login/read authorization; không dùng Firebase `?id=`                                                            |
| `public/manifest.json`, `src/app/layout.tsx`, `next.config.ts`, `src/sw.ts`, `src/components/pwa-install-prompt.tsx` | Existing manifest/icons/single Serwist registration; đã có defaultCache/precache, chưa chứng minh install/push thực tế                                   |

## Regression baseline ZBS

Runnable source lock: `node openspec/changes/add-web-push-notifications/phase-1-baseline.check.mjs`. Không dependency/framework mới. Check đọc định nghĩa create mới nhất và khóa ZBS INSERT SELECT bằng SHA-256 whitespace-normalized; guard priority/network/error swallowing và thứ tự create/status/history/audit/enqueue. Cùng check xác nhận raw JSON/digest/HMAC của vector công khai §2 contract (PASS); không gọi API/provision secret. Phase 3 phải giữ ZBS block và bổ sung behavior test DB; không reset hash để che regression.

| Hành vi bảo toàn                | Evidence Phase 1                                                                                                                       | Giới hạn / nghiệm thu phase sau                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mọi priority                    | Source create 7 args không priority field/filter; source check khóa absence của priority guard                                         | Không bịa enum/fixture priority mới; DB Phase 3 xác nhận mỗi create hợp lệ enqueue, không chỉ khẩn cấp                      |
| Tenant/phone/snapshot/unique    | Source hash của nguyên INSERT SELECT: tenant từ v_tb, active/event filter, cfg.phone, tracking key và ON CONFLICT                      | Static lock không thay thế execution DB                                                                                     |
| Không recipient, không fallback | INSERT SELECT không có row thì zero outbox; source hash khóa join/filter                                                               | SQL fixture cũ có tenant C/no active recipients nhưng chưa chạy trong lượt này                                              |
| Rollback                        | Source cùng function transaction, audit failure raise, không swallow/network; check thứ tự và không transaction control                | Chưa DB fault injection; `scripts/verify-zbs-repair-outbox.sql` chỉ cleanup bằng rollback, không assertion rollback sau lỗi |
| Delivery failure isolation      | Existing live-dispatcher tests về retryable/final error không abort batch, persistence failure không mark failed sau provider accepted | Mock provider/RPC, không chứng minh DB transaction/live delivery; Web Push independence behavior nghiệm thu Phase 3/7       |

Không chạy `scripts/verify-zbs-repair-outbox.sql`: fixture cũ dùng `nhan_vien.is_active`, không được suy ra từ đó current account lifecycle; cần kiểm schema fixture trước reuse. Không sửa SQL theo boundary lượt này. Không chạy toàn bộ supabase/tests, không Oracle/live validation. DB static lane và baseline-forward: **N/A (không migration/registry diff)**, không ghi aggregate DB PASS.

Lệnh baseline đã chạy trên source pin trước edits:

```sh
node scripts/npm-run.js run test:run -- src/lib/zbs/__tests__ src/lib/__tests__/firebase-runtime-audit.test.ts src/lib/__tests__/repair-request-deep-link.test.ts src/lib/__tests__/repair-request-deep-link.adoption.test.ts src/app/api/rpc/__tests__/rpc-session-claims.phase35.test.ts
```

Kết quả: **12 files pass, 1 file failed; 75 tests pass, 1 failed**. ZBS suites, Firebase runtime audit, view deep-link helper và RPC claims pass. Failure: `src/lib/__tests__/repair-request-deep-link.adoption.test.ts:47`, QR scanner source-adoption assertion đòi helper trong `page.tsx` nay chỉ là server shell. Đây là baseline ngoài scope, không sửa runtime/test cũ, không báo toàn baseline xanh. Follow-up [#997](https://github.com/thienchi2109/qltbyt-nam-phong/issues/997) được tạo và giữ open; không có Web Push phase issue hiện hữu để đóng.

Source check đã chạy PASS. Mutation check trên bản sao tạm (không sửa source SQL) xác nhận bản gốc exit 0; đổi tenant filter, bỏ audit statement hoặc thêm priority filter đều exit 1. Đây là evidence source check có bắt regression mục tiêu, không phải TDD/DB execution. Formatting `format:check`, diff-only `verify:dedupe` và `openspec validate add-web-push-notifications --strict` PASS. Không thay đổi TS/TSX, nên không yêu cầu chạy React Doctor/browser/full suite cho diff artifacts này; pre-push typecheck của repo vẫn giữ nguyên.

## Requirement review (task 1.4)

Review contract là review tài liệu, không chứng nhận implementation phase sau.

| Requirement trong notifications/spec.md | Contract coverage                                              | Verification tiếp theo                                    |
| --------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| Independent Web Push Channel            | §1/4, bảng ZBS baseline                                        | Phase 3 atomic enqueue + Phase 7 hai kênh                 |
| Tenant Scoped Account Configuration     | §1/5: trim/lower/dedupe/atomic, caller khác recipient          | Phase 2 tenant tamper/invalid list                        |
| In App Notification Registration        | §1/4/6: server session, consent, SSRF                          | Phase 4 validation, Phase 5 user-event                    |
| Subscription Lifecycle                  | §3/4: revision, multi-browser, logout/offline, epoch           | Phase 4 concurrency + Phase 5 lifecycle                   |
| Transactional Notification Intent       | §4: unique/snapshot/materialize/deadline                       | Phase 3 rollback/no backfill                              |
| Authenticated Oracle Worker             | §1/2: source, HMAC, shared nonce, fenced report                | Phase 4/6 wire/replay checks                              |
| Bounded Delivery And Retry              | §4: limits, status mapping, TTL, lost report                   | Phase 6 faults + Phase 7 latency                          |
| Notification Content And Navigation     | §6: 3 fields, Unicode/JSON byte cap, view link                 | Phase 5/6 long payload/click                              |
| Browser And Operational Readiness       | §3/4/6: owner, controls, counters, platform matrix             | Phase 7/8; chưa browser/production PASS                   |
| VAPID Key Compatibility                 | §3: decoded key fingerprint/version, no restart generation     | Phase 4 test public artifact + Phase 6 readiness          |
| Home Screen Installability              | §6: reuse manifest/Serwist, inventory gaps, installed iOS      | Phase 5 inventory + Phase 7 device evidence               |
| Subject Based Recipient Authorization   | §5: durable truth table, expert deny, C/H, stale claims caveat | Phase 2 DB parity từ fresh profile, không worker identity |

Không mở lại lựa chọn Go/Oracle, mọi priority, username recipients, lock-screen content, 24 giờ hoặc các browser đã chốt. Bổ sung chi tiết technical cần thiết: wire v1/nonce store, VAPID handoff, limits, source scope và truth table. Contract phân biệt login/current session/durable profile để không hứa parity sai.

## Closeout

Review `post_implementation_reviewer` đối chiếu base pin và acceptance Phase 1 tìm hai Important, không Critical: điều kiện subscription bị đặt nhầm chung cho config/enqueue; retention subscription chưa pin FK deletion. Đã sửa §5 thành ba stage config/enqueue/claim, và §1/4 thành nullable `ON DELETE SET NULL` với immutable subscription identity bảo toàn unique/history. Đã đối chiếu lại hai điểm sửa với spec; không mở rộng runtime.

Source/HMAC check, OpenSpec strict, formatting và diff-only duplicate gate PASS; requirement mapping 12/12, diff chỉ trong change này. Chỉ tick 1.1–1.4; Phase 2–8 giữ trống. Retrieval memory ID không có trong store hiện tại và baseline QR adoption đỏ được báo rõ, theo dõi #997. Không có blocker tài liệu còn mở sau review; **không có aggregate runtime/DB/browser PASS** và không có quyền live apply/deploy từ contract này. Landing trên branch `docs/web-push-phase-1-contract`, giữ hooks; commit/push được xác nhận ở handoff của phiên, không archive change.
