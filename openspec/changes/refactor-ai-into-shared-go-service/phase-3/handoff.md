# Phase 3 Handoff

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase3`  
Base: `c603e31f4b70bc58ba51e16715f9f74a7cac9256`

## Commit

- `c898d3f1` feat(ai): add phase 3 draft quota and kill switch
- `f90c9d5f` fix(ai): bound phase 3 cleanup and reservation claims
- `20cc4a46` docs(ai): record phase 3 quota evidence

Review fresh-context trên `c603e31f..c898d3f1` không có Critical và có 3 Important. Cả ba được xử lý trong `f90c9d5f` và được đối chiếu lại là đã xử lý, không phát sinh Critical hoặc Important mới.

## Trạng thái

Phase 3 đã chuyển draft orchestration, secondary extraction, budget ngữ cảnh cộng dồn, lifecycle `ai_quota_reserve` / `ai_quota_finalize`, kill-switch, và kiểm chứng crash recovery vào adapter QLTBYT. Evidence nằm ở `phase-3/phase-3-evidence.md`. Checklist 3.1–3.8 được tick vì có test trong change này. Checklist Phase 0–2 và Phase 4 trở đi không bị sửa.

Không có runtime production change. `src/app/api/chat/route.ts` không đổi. Không migration/DDL, không live DB write, không deploy, không paid-provider smoke.

Accounting sau reservation expiry vẫn là `expired-uncertain`: không measured, không refund. Replay và finalize trước expiry không đổi. Request id trùng trả 409 trước reserve RPC thứ hai và trước khi mở provider, kể cả khi lần đầu refund vì provider chưa chạy.

## Quyết định giữ

- Undercount chỉ được chấp nhận khi recovery bắt đầu tại hoặc sau expiry. Known zero khác unknown/partial. Không refund usage không biết.
- Marker uncertainty nằm trong journal và reconciliation. RPC chỉ nhận `success`, `error_with_usage`, `error_no_usage`. Số 0 trên RPC là sentinel tương thích khi marker là `partial` hoặc `unknown`.
- Quota tenant là cơ sở đã validate (`EffectiveFacilityID`), không phải tên hiển thị và không phải session facility khi user có quyền chọn cơ sở khác.
- `uiArtifact` của lượt tool hiện tại giữ trong trace UI. History và bước trước trong cùng lượt được compact khi đo budget và khi gửi cho provider. Không xóa artifact hiện tại để qua giới hạn 40000.
- Clarification trả trước budget, reserve, và kill-switch. Kill-switch env thắng. Cache 8 giây sau đọc DB thành công, 2 giây sau lỗi đọc, fail-closed trước model/tool.
- Cleanup finalize tối đa 5 giây, không cộng drain 60–90 giây vào deadline việc 55 giây. Drain process và HTTP stop timeout thuộc phase sau.
- Journal không lưu credential. Recovery dùng `QuotaCaller` được inject. Host HTTP sau này phải đưa caller không nới user hoặc facility.
- Broker chat được gọi `ai_quota_reserve`, `ai_quota_finalize`, và `ai_kill_switch_status`. Cleanup chỉ finalize khi có `p_reservation_id` và không nới user/facility. Reserve trên cleanup vẫn bị từ chối. Catalog tool không tự gọi quota RPC.
- Google quota rotation, prefix `google/`, cancellation của `Authorize`, HMAC, và guard SQL Phase 2 giữ nguyên.

## Residual

- Body `ai_kill_switch_status` rỗng hoặc không parse được đang bị coi là tắt và cache 8 giây. Lỗi transport vẫn fail-closed 2 giây. Phải xử lý trước khi kill-switch đọc RPC thật ở Phase 4 hoặc Phase 5: payload không parse được phải đi vào cache fail-closed 2 giây.
- Session draft kết thúc khi content chứa đúng substring `"kind":"repairRequestDraft"`. Shape part `tool-generateRepairRequestDraft` của UI chưa được nhận diện riêng. Phải khóa lại trước fixture UI Phase 5, không để lượt sau extract lại một draft đã hoàn tất dưới shape khác.
- `quota_book.go` còn 376 dòng, dưới trần 450. Tách reload journal trước khi thêm accounting mới.
- Test hằng số chứng minh drain không được cộng vào 55 giây. Chưa có deadline HTTP thật dùng các hằng số đó. Phase 4 và Phase 6 mới thực thi deadline và stop timeout.
- Chưa có test riêng cho `Attempts` khi retry lỗi quota rồi rotate key. Meter hiện ghi từng lần `Generate`. Bổ sung test này trước cutover Phase 8.
- `Sync` journal bị bỏ chờ khi cleanup hết hạn, nhưng goroutine sync vẫn có thể ghi xong sau đó. Caller không đợi. Không coi đường này là hủy được lệnh sync. Phase 4 phải giữ nguyên giới hạn này khi nối cleanup HTTP.
- Recovery không tự có credential trong journal. Thiếu caller thì fail-closed, không finalize. Phase 4 phải inject caller recovery không nới scope.

## Boundary và mốc xử lý

| Hạng mục                                                                                                                  | Mốc                                                                                 | Điều kiện hoàn tất / chặn                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget context cộng dồn, draft, secondary extraction, quota reserve/finalize, kill-switch                                 | Phase 3 (3.1–3.8), local/mock trên nhánh này                                        | Đã có test. Giữ UI artifact hiện tại. Known-zero/partial/unknown phân biệt được. Crash recovery trước expiry finalize một lần. Undercount chỉ khi recovery bắt đầu sau expiry. Không refund uncertainty. |
| Payload kill-switch không parse được, shape hoàn tất của draft UI, test retry quota `Attempts`, sync journal sau deadline | Trước Phase 4 nối RPC thật và trước fixture UI Phase 5; test Attempts trước Phase 8 | Không chặn tick 3.1–3.8. Không được coi là đã xong khi đọc DB thật hoặc cutover.                                                                                                                         |
| Role `ai_query_tool`, grants/schema/view, audit RPC và tenant policy                                                      | SQL change riêng nếu cần provisioning; xác minh trước bất kỳ bật tool thật nào      | Không tạo migration ngầm. SQL change cần static + Oracle baseline-forward trên cùng commit; live apply cần approval riêng qua Supabase MCP. Thiếu connection/audit thì tool tắt.                         |
| Driver PostgreSQL/pool, concrete BFF RPC broker và deployment wiring                                                      | Trước dark integration chạm DB thật; kiểm tra tại Phase 4–5, gate lần nữa trước 7.6 | Driver giả không chứng minh PostgreSQL/grants. Broker phải xác thực lại credential, allowlist và signed user claims; Go không giữ Supabase signing secret.                                               |
| HTTP/SSE, writer I/O errors, deadline 55s + cleanup trong 60s, abort end-to-end, admission/readiness                      | Phase 4 (4.1–4.6)                                                                   | Encoder v1 local và hằng số 55+5 không đủ để tick Phase 4. Kiểm tra installed SDK parser, tool/artifact order, write failure/disconnect và streaming từ handler xuyên provider/tool/RPC.                 |
| Dark BFF, session/signing/proxy, dịch lỗi ở boundary HTTP, app quota mapping, UI fixtures                                 | Phase 5 (5.1–5.6)                                                                   | Giữ `provider_quota` khác `ai_usage_limited`; kiểm tra post-stream/pre-stream error và abort. Không đổi route production.                                                                                |
| Container, Tunnel/Access, secrets, drain/replay recovery và operator runbook                                              | Phase 6                                                                             | Local/private ports; không suy ra authorization deploy. Trần drain 60–90 giây đã được ghim, chưa được thực thi bởi orchestrator.                                                                         |
| Dark deployment và smoke                                                                                                  | Phase 7, sau approval deploy                                                        | Smoke có quota/audit write hoặc provider trả phí cần approval đúng operation; không tự dùng live data.                                                                                                   |
| `/api/chat` production cutover                                                                                            | Phase 8                                                                             | Cùng subject commit/image digest, acceptance PASS và explicit cutover approval.                                                                                                                          |
| Xóa runtime AI cũ                                                                                                         | Phase 9                                                                             | Chỉ sau Phase 8 được chấp nhận; giữ UI/shared imports.                                                                                                                                                   |

Facility rejection trước executor vẫn không tạo SQL failure audit. `p_sql_shape` rỗng dùng `empty`. Literal trong audit DB vẫn là quyết định đã chấp nhận. Route production vẫn gọi `src/lib/ai/usage-metering.ts`; lifecycle Go không thay đường đó.

Dừng trước Phase 4. Bảng trên không cấp phép bắt đầu phase sau, deploy, hoặc live write. Không sửa predecessor checklist.
