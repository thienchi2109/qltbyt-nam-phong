# Phase 5 - Evidence và handoff artifacts

Ngày 2026-09-13. Phạm vi lượt này chỉ khảo sát và chỉnh tài liệu; chưa triển khai UI Phase 5.

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

- Luna-max khảo sát/chỉnh artifacts; agent chính đọc diff và chạy độc lập `openspec validate add-web-push-notifications --strict` và `git diff --check`: PASS trước closeout.
- Dynamic reviewer báo 5 file/21 focused user-event tests hiện có PASS, exit 0, bao phủ shell/bell/tenant/users UI. Đây là baseline UI hiện có, không chứng minh Phase 5 đã chạy.
- Browser smoke bằng Chrome/agent-browser trên Next local gặp redirect `/api/auth/error?error=Configuration`; authenticated DOM interaction chưa kiểm chứng. Server tạm đã dừng. Không claim browser Phase 5 PASS.
- Không chạy lại Phase 4.5 hoặc DB Gate; giữ nguyên kết quả lịch sử. Không live write, deploy, bật registration hay gửi push.

## Handoff tiếp theo

Chỉ bắt đầu Chunk 5.1 khi maintainer giao triển khai; dùng quyết định placement đã chốt, giữ các chunk sau unchecked. Khóa hành vi bằng focused user-event tests, kiểm tra quyền truy cập route cho `to_qltb`, bảo toàn bell dialog và full-config selection. Chạy các TS/React gates theo repo khi có runtime diff. Browser auth limitation cần kiểm chứng lại khi môi trường authenticated sẵn sàng.

Maintainer đã yêu cầu commit và push bộ artifacts trên `main`; SHA landing và kết quả sync được báo trong phản hồi closeout, không suy diễn từ việc tạo tài liệu này.
