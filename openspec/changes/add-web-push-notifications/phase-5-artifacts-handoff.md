# Phase 5 - Evidence và handoff artifacts

Ngày 2026-09-14. Chunk 5.3 đã landing trực tiếp trên `main` tại commit `36c86464971016665deef15fbaa6b2eab6f5de14`; `main` và `origin/main` đồng bộ.

## Baseline và phạm vi

- Tree sạch trước khi bắt đầu; sau fetch, `main` và `origin/main` cùng commit `e9e2504ee30efed22c8b669cd94cbbb20c99cd37`.
- Đã đọc proposal, design, notification spec, tasks, Phase 1 contract và evidence/handoff Phase 1–4.5. Phase 4.5 đã landed/live theo bối cảnh maintainer; không sửa hoặc chạy lại phase này.
- GitHub xác nhận [#1001](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1001) CLOSED lúc `2026-09-13T12:36:28Z`. Issue đóng không phải bằng chứng aggregate DB Gate PASS.
- Chỉ sửa proposal, design, notification spec, tasks và handoff này. Không sửa runtime/backend/API/RPC/SQL/migration/Lefthook; DB Gate đang tắt khỏi hooks và không chặn Phase 5.

## Quyết định đã chốt qua Grilling

- Route authenticated `/notifications`; giữ dialog chuông hiện tại và thêm link đúng text **Cài đặt nhận thông báo**. Không thêm sidebar hoặc link user menu trùng lặp; giữ Đổi mật khẩu và Đăng xuất.
- Mọi tài khoản đăng nhập thấy card hướng dẫn/trạng thái browser. Nút **Bật thông báo** tuân theo eligibility và controls của API hiện có; không tự prompt khi tải trang. Người dùng tự cấp quyền, app đăng ký subscription sau khi được phép.
- Hướng dẫn riêng khi denied/unsupported, lỗi subscription hoặc iOS/iPadOS cần Add to Home Screen. Không prompt lặp sau khi từ chối; quyền đã chặn cần người dùng tự đổi trong trình duyệt.
- Hiển thị rõ: **Bật thông báo trên trình duyệt không tự thêm bạn vào danh sách người nhận.**
- Recipient config chỉ dành cho `to_qltb/admin/global`. `to_qltb` chỉ cấu hình đơn vị hiệu lực; `admin/global` chọn mọi đơn vị và tự thêm/gỡ protected self-entry của mình. Protected entry của người khác read-only.
- Giữ isolation theo `don_vi`, không fallback; config không cấp quyền đọc repair request. Stale/ineligible được hiển thị, không nhận push, được gỡ theo quyền; full-config selection không mất qua search/reload và save atomic.

## Đúng năm chunk, chưa tick implementation

1. **5.1:** picker nhiều tài khoản có sẵn, không nhập username tự do/CSV.
2. **5.2:** trạng thái cấu hình, protected/stale/ineligible và quyền sửa/gỡ.
3. **5.3:** subscription opt-in, permission và accessible feedback.
4. **5.4:** trạng thái thao tác UI, retry/cancel/error, refresh/reload và browser lifecycle; không điều khiển retry delivery backend.
5. **5.5:** tích hợp trang/service worker hiện có, responsive/accessibility, focused user-event tests và polish.

## Evidence và giới hạn

- Chunk 5.3 implementation: Web Push opt-in UI trên `/notifications`, permission/user-gesture states, public-key/version handling, worker reuse, lock-screen preview và collapsed iOS/iPadOS Home Screen guidance. Không đổi backend/API/RPC/SQL.
- TDD evidence: RED 7/7 trên `origin/main` (`/tmp/web-push-53-red.log`, SHA-256 `5882d80fa000bf9e6e6e4d769aaafddb11a9efa43128f86ec14985661305fde3`); GREEN 31/31 trước review, sau regression additions focused suite 32/32 PASS.
- Dynamic review findings P1 stale VAPID artifact và P2 public-key preflight dead-end đã được sửa và có regression tests.
- Independent staged verification: format, no-explicit-any, dedupe, typecheck PASS; focused 32/32 PASS; opt-in 8/8 PASS; diff-only React Doctor final diff-only scan: 100/100, no findings on the 5 changed files. Full-repository baseline remains 49/100 with 296 pre-existing findings.

- Agent chính đã review động diff, đọc toàn bộ file mới, và chạy độc lập `git diff --check`, focused tests và staged gates.
- Dynamic reviewer báo 5 file/21 focused user-event tests hiện có PASS, exit 0, bao phủ shell/bell/tenant/users UI. Đây là baseline UI hiện có, không chứng minh Phase 5 đã chạy.
- Browser smoke bằng Chrome/agent-browser trên Next local gặp redirect `/api/auth/error?error=Configuration`; authenticated DOM interaction chưa kiểm chứng. Server tạm đã dừng. Không claim browser Phase 5 PASS.
- Không chạy lại Phase 4.5 hoặc DB Gate; giữ nguyên kết quả lịch sử. Không live write, deploy, bật registration hay gửi push.

## Handoff tiếp theo

Chunk 5.3 đã hoàn tất và đã landing/push. Tiếp theo chỉ bắt đầu Chunk 5.4 khi maintainer giao; giữ 5.5 và các phase ngoài phạm vi. Browser auth limitation vẫn cần kiểm chứng khi môi trường authenticated sẵn sàng. Giữ 5.4/5.5 và Phase 4.5/DB Gate ngoài phạm vi. Browser auth limitation vẫn cần kiểm chứng khi môi trường authenticated sẵn sàng.

Post-landing verification: focused notifications suites 32/32 PASS từ `/tmp/web-push-53-landed-tests.log`; `git rev-parse HEAD origin/main` cùng trả về `36c86464971016665deef15fbaa6b2eab6f5de14`.
