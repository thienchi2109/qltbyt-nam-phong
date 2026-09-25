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
- SQL guard fail-closed với comma relation list, Unicode escaped identifiers, `INTO`, schema/view ngoài allowlist; regression tests bao phủ cả cú pháp hợp lệ không bị chặn.
- Query timeout nội bộ vẫn ghi failure audit khi request cha còn sống. Parent cancellation trả context error và không để raw driver message rời adapter.
- `SQLExecutor` concrete dùng injected `database/sql`, read-only transaction, kiểm tra role `ai_query_tool`, áp dụng settings và `LIMIT 101`, giới hạn rows/payload, rồi sanitize lỗi. Đây là local/mock contract; role thật chưa được provision.
- Role/connection `ai_query_tool` và schema audit là SQL change riêng, chưa được làm ở đây.
- Lỗi protocol của Go vẫn tiếng Anh. BFF map sang câu tiếng Việt cố định theo mã. `provider_quota` không thành `ai_usage_limited`.

## Stream writer

`Send` trả `closed=true` khi reader đóng và không giao chunk. `writer.Close` làm `Recv` nhận EOF và không set cờ closed. Chỉ forwarder đóng writer. HTTP đóng reader khi client hủy. Lỗi stream tới reader còn mở được ghi thành event đã sanitize.

## Bước tiếp theo

Dừng trước Phase 3. Phase 3 chỉ bắt đầu khi user duyệt. Phase 3 mới chuyển draft orchestration, secondary extraction, `ai_quota_reserve` / `ai_quota_finalize`, và kill-switch.

## Residual còn lại

- Cutover `/api/chat` chưa làm. Mapper quota app tồn tại nhưng chưa được chat gọi.
- `SQLExecutor` đã gọi settings và limited statement thật qua `database/sql` với test driver giả. Chưa có driver PostgreSQL/pool production hoặc kiểm chứng role/connection thật; không bật tool trên môi trường thật.
- Budget ngữ cảnh cộng dồn thuộc Phase 3. Không tự bỏ `uiArtifact` của lượt tool hiện tại.
- Provisioning `ai_query_tool`, audit RPC/schema và migration/DDL là SQL gate riêng; không bật tool thật trước gate đó.
- UI Message Stream v1 mới được kiểm thử ở ingress local; chưa có production BFF/cutover, Tunnel/Access, deploy hoặc `/api/chat` routing.
- Primary/secondary quota lifecycle, unknown/partial accounting, kill-switch và draft orchestration vẫn thuộc Phase 3; chưa được tick.
- Literal trong `p_sql_shape` vẫn nằm trong audit DB theo quyết định đã duyệt; chỉ operational log được redact SQL.

## Boundary và mốc xử lý

| Hạng mục                                                                                             | Mốc                                                                                 | Điều kiện hoàn tất / chặn                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget context cộng dồn, draft, secondary extraction, quota reserve/finalize, kill-switch            | Phase 3 (3.1–3.8) sau user approval                                                 | Giữ UI artifact hiện tại; kiểm chứng known-zero/partial/unknown, crash recovery trước expiry, không refund uncertainty. Chấp nhận undercount chỉ khi recovery bắt đầu sau expiry. |
| Role `ai_query_tool`, grants/schema/view, audit RPC và tenant policy                                 | SQL change riêng nếu cần provisioning; xác minh trước bất kỳ bật tool thật nào      | Không tạo migration ngầm. SQL change cần static + Oracle baseline-forward trên cùng commit; live apply cần approval riêng qua Supabase MCP. Thiếu connection/audit thì tool tắt.  |
| Driver PostgreSQL/pool, concrete BFF RPC broker và deployment wiring                                 | Trước dark integration chạm DB thật; kiểm tra tại Phase 4–5, gate lần nữa trước 7.6 | Driver giả không chứng minh PostgreSQL/grants. Broker phải xác thực lại credential, allowlist và signed user claims; Go không giữ Supabase signing secret.                        |
| HTTP/SSE, writer I/O errors, deadline 55s + cleanup trong 60s, abort end-to-end, admission/readiness | Phase 4 (4.1–4.6)                                                                   | Encoder v1 local không đủ để tick Phase 4. Kiểm tra installed SDK parser, tool/artifact order, write failure/disconnect và streaming từ handler xuyên provider/tool/RPC.          |
| Dark BFF, session/signing/proxy, dịch lỗi ở boundary HTTP, app quota mapping, UI fixtures            | Phase 5 (5.1–5.6)                                                                   | Giữ `provider_quota` khác `ai_usage_limited`; kiểm tra post-stream/pre-stream error và abort. Không đổi route production.                                                         |
| Container, Tunnel/Access, secrets, drain/replay recovery và operator runbook                         | Phase 6                                                                             | Local/private ports; không suy ra authorization deploy.                                                                                                                           |
| Dark deployment và smoke                                                                             | Phase 7, sau approval deploy                                                        | Smoke có quota/audit write hoặc provider trả phí cần approval đúng operation; không tự dùng live data.                                                                            |
| `/api/chat` production cutover                                                                       | Phase 8                                                                             | Cùng subject commit/image digest, acceptance PASS và explicit cutover approval.                                                                                                   |
| Xóa runtime AI cũ                                                                                    | Phase 9                                                                             | Chỉ sau Phase 8 được chấp nhận; giữ UI/shared imports.                                                                                                                            |

Facility rejection trước executor vẫn không tạo SQL failure audit; đây là pre-execution authorization denial. `p_sql_shape` rỗng dùng `empty` để giữ audit nonempty. Hai hành vi này cần giữ rõ trong contract review trước live integration, không được dùng làm lý do bỏ audit của SQL đã thực thi. Literal trong audit DB là quyết định đã chấp nhận, không phải pending fix.

Dừng ở Phase 2; bảng trên không cấp phép bắt đầu phase sau, deploy hoặc live write. Không sửa predecessor checklist.

Final review commit `d47c3457` không còn Critical/Important findings. Phase 2 đủ điều kiện fast-forward vào `main`; Phase 3 vẫn chưa được duyệt hoặc bắt đầu.
