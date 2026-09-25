# Phase 2 Handoff

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase2`  
Base: `ac1599c378a6162b3fd0e2262d891b80827d67fa`

## Trạng thái

Phase 2 đã có adapter QLTBYT, broker RPC, guard `query_database`, ingress HMAC/stream, và BFF dịch lỗi sang tiếng Việt. Evidence nằm ở `phase-2/phase-2-evidence.md`. Checklist 2.1–2.7 đã tick vì có test trong change này. Phase 3 trở đi vẫn chưa tick và chưa được thực hiện.

Không có runtime production change. `src/app/api/chat/route.ts` không đổi. Không migration/DDL, không live DB write, không deploy, không paid-provider smoke.

Accounting sau reservation expiry vẫn là `expired-uncertain`: không measured, không refund. Replay/finalize trước expiry không đổi. Request id trùng vẫn 409 từ `usage.Memory.Reserve` nếu tới lớp đó; ingress từ chối replay HMAC bằng HTTP 409 trước khi mở provider lần hai.

## Quyết định giữ

- Undercount chỉ được chấp nhận sau expiry. Known zero khác unknown/partial. Không refund usage không biết.
- Google quota rotation, prefix `google/`, và cancellation của `Authorize` giữ nguyên từ Phase 1.
- HMAC đúng `phase-0/hmac-parameters.md`. App id của key binding là dữ liệu cấu hình. Package neutral không chứa identifier QLTBYT.
- Broker không giữ secret ký Supabase, cookie, hay `service_role`. Cleanup tối đa 5 giây và không nới quyền.
- `query_database` tắt khi thiếu executor read-only hoặc thiếu audit broker. Log redact không thay audit DB.
- Lượt tool hiện tại giữ `uiArtifact` (trừ `departmentList`). History gửi lại model thì bỏ `uiArtifact`. `p_user_id` của RPC catalog là chuỗi.
- Guard SQL đọc identifier trong ngoặc kép, cấm `SELECT … INTO`, và chỉ cho view `ai_readonly` đã duyệt. Schema tool được publish cho model và được validate trước RPC. Budget compaction tính sau khi bỏ artifact lịch sử; clarification cơ sở không bị gate đó chặn.
- `p_sql_shape` là câu đã chuẩn hóa khoảng trắng, tối đa 1000 ký tự. Literal trong câu vẫn nằm trong audit DB. Operational log không ghi SQL.
- Role/connection `ai_query_tool` và schema audit là SQL change riêng, chưa được làm ở đây.
- Lỗi protocol của Go vẫn tiếng Anh. BFF map sang câu tiếng Việt cố định theo mã. `provider_quota` không thành `ai_usage_limited`.

## Stream writer

`Send` trả `closed=true` khi reader đóng và không giao chunk. `writer.Close` làm `Recv` nhận EOF và không set cờ closed. Chỉ forwarder đóng writer. HTTP đóng reader khi client hủy. Lỗi stream tới reader còn mở được ghi thành event đã sanitize.

## Bước tiếp theo

Dừng trước Phase 3. Phase 3 chỉ bắt đầu khi user duyệt. Phase 3 mới chuyển draft orchestration, secondary extraction, `ai_quota_reserve` / `ai_quota_finalize`, và kill-switch.

## Residual không chặn review Phase 2

- Cutover `/api/chat` chưa làm. Mapper quota app tồn tại nhưng chưa được chat gọi.
- SSE ở ingress là event trung lập cho contract này, chưa phải encoder Vercel AI SDK UI Message Stream của task 4.3.
- Chưa có provisioning SQL cho `ai_query_tool` hay audit. Không bật `query_database` trên môi trường thật khi chưa có gate đó.
- Lỗi driver bất thường vẫn có thể đi qua biên tool nội bộ trước `publicError`. Chưa có bằng chứng lỗi đó tới model hoặc browser.
- Budget ngữ cảnh cộng dồn thuộc Phase 3. Không tự bỏ `uiArtifact` của lượt tool hiện tại.
