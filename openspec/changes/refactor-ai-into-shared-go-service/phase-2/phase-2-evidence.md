# Phase 2 Evidence

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase2`  
Base: `ac1599c378a6162b3fd0e2262d891b80827d67fa`

Phase 2 thêm adapter QLTBYT, broker RPC đã ký, guard `query_database`, ingress HMAC/stream trung lập, và mapper lỗi tiếng Việt ở BFF. Không bắt đầu Phase 3. Không đổi route chat production. Không deploy, không live DB write, không migration/DDL, không paid-provider smoke.

## Phạm vi đã làm

- Adapter `services/ai-service/internal/qltbyt` đăng ký capability `qltbyt` / `assistant-chat` / `v1` từ package này. Core neutral chỉ nhận registry đã dựng sẵn.
- Prompt hệ thống `v2.6.1` giữ rule vai trò/cơ sở. Tên hiển thị và `identity.tenant` không phải quota tenant hay thẩm quyền. `admin` được chuẩn hóa như `isGlobalRole` / `isPrivilegedRole`: privileged mà chưa có cơ sở được chọn thì nhận câu hướng dẫn và không truy vấn mọi cơ sở. User không privileged bị bỏ `requested facility`; cơ sở session thắng.
- Intent routing khóa các case curated-first, gồm fallback `query_database` trong `intent-routing.test.ts`. `systemDiagnostics` và tool lạ bị từ chối trước reserve/provider. `generateRepairRequestDraft` và `generateTroubleshootingDraft` chỉ là descriptor (`troubleshootingDraft`, `repairRequestDraft`); model không thực thi chúng. Chưa chuyển orchestration draft.
- Allowlist tool là catalog hiện tại cộng hai draft và `query_database`. RPC catalog lấy từ `query-catalog.ts`, không đoán tên: `usageHistory` là `ai_usage_summary`, `attachmentLookup` là `ai_attachment_metadata`. Các RPC còn lại đúng tên đã liệt kê.
- Broker là interface được inject. Go không giữ `SUPABASE_JWT_SECRET`, cookie trình duyệt, hay `service_role`. Envelope: issuer `nextjs-bff`, audience `qltbyt-rpc-broker-v1`, đời tối đa 120 giây, `user_id` số. Allowlist biết catalog RPC, `assistant_query_database_audit_log`, `ai_quota_reserve`, và `ai_quota_finalize`. Chat/tool không gọi hai RPC quota. Cleanup tách context tối đa 5 giây, không đổi user, cơ sở, hay RPC ngoài audit.
- `query_database` chỉ được offer/execute khi có cả executor read-only (`ai_query_tool`) và broker audit. Timeout 5000ms, tối đa 100 dòng, payload 64KiB, search path `ai_readonly, pg_catalog`. Guard từ chối DDL/DCL/write, nhiều statement, schema lạ, và các lớp trong `query-database-guard.test.ts`. Success: execute, audit, rồi mới trả dòng. Audit lỗi thì không trả dòng và không thành success rỗng. Failure: audit best-effort, nuốt lỗi audit, giữ lỗi gốc. Shape đã sanitize, nonempty, tối đa 1000 ký tự; hash không thay shape. Log chỉ request id và error class.
- Kết quả catalog của lượt tool hiện tại giữ envelope đầy đủ: `modelSummary`, `followUpContext` khi tool thuộc nhóm evidence, và `uiArtifact.rawPayload` trừ `departmentList`. Budget `maxItems`/`maxBytes`/`modelVisibleFields` chỉ cắt `importantFields`. Lịch sử gửi lại model bị gỡ `uiArtifact`. `query_database` trả summary, follow-up, và chart khi dòng khớp báo cáo; không trả raw row JSON trần. `p_user_id` gửi sang RPC là chuỗi JSON, đúng tham số `text`. Clarification từ `Prepare` không reserve, không mở provider, và không bị gate 40000 ký tự loại bỏ.
- Ingress `POST /v1/chat` dùng đúng tham số HMAC Phase 0. App id của key binding là cấu hình, không hard-code trong package neutral. Readiness local là cờ quarantine 150 giây; không thêm `/healthz`, Cloudflare, container, hay CI. Replay cùng request id trả HTTP 409 và không mở provider lần hai. `usage.Memory.Reserve` vẫn trả 409 nếu bị gọi lại. Accounting post-expiry không đổi.
- BFF `src/lib/ai/go-bff/` dịch message người dùng sang tiếng Việt theo mã. Core vẫn tiếng Anh. `provider_quota` không bị đổi thành `ai_usage_limited`. Mapper quota app nằm riêng và không được chat gọi. `src/app/api/chat/route.ts` không đổi.

## Semantics stream đã khóa

- `StreamWriter.Send` trả `closed=true` khi reader đã `Close` (`closeRecv` đóng `s.closed`). Chunk hoặc lỗi đó không được giao.
- `StreamWriter.Close` (`closeSend`) đóng channel items nên `Recv` kế tiếp là `io.EOF`. Nó không set `s.closed`.
- Send sau `Close` của writer có thể panic. Chỉ goroutine forward gọi `writer.Close`. HTTP gọi `reader.Close` khi client hủy để `Send` thấy `closed=true`.
- `forwardStream` gửi lỗi bằng `Send(nil, err)`. Nếu `Send` trả true thì forwarder dừng. `writer.Close` vẫn chạy qua defer. Reader đã đóng thì lỗi bị bỏ là đúng. Reader còn mở thì HTTP thấy lỗi đã sanitize, không thấy token, SQL, hay prompt gốc.

## Map lỗi tiếng Việt

| Mã                       | Message cố định                                                   |
| ------------------------ | ----------------------------------------------------------------- |
| `invalid_request`        | Yêu cầu không hợp lệ.                                             |
| `capability_unavailable` | Tính năng trợ lý này hiện không khả dụng.                         |
| `unauthorized`           | Anh/chị không có quyền thực hiện yêu cầu này.                     |
| `limit_exceeded`         | Yêu cầu vượt quá giới hạn cho phép.                               |
| `provider_failure`       | Bộ mô hình không hoàn tất được yêu cầu. Vui lòng thử lại sau.     |
| `provider_quota`         | Nhà cung cấp mô hình đang tạm thời quá tải. Vui lòng thử lại sau. |
| `cancelled`              | Yêu cầu đã được hủy.                                              |
| `tool_limit`             | Yêu cầu vượt quá giới hạn sử dụng công cụ.                        |

## SQL gate tách riêng

Provisioning role/connection `ai_query_tool` và schema/RPC audit vẫn là SQL change riêng với quality gate riêng. Phase 2 có `SQLExecutor` concrete trên injected `database/sql` và test driver giả; chưa có driver PostgreSQL/pool production hoặc kết nối DB thật. Không có migration. Chỉ dùng executor này cho cấu hình thật sau khi xác minh role, grant, tenant policy và audit path; nếu thiếu thì giữ tool tắt.

## Kiểm tra đã chạy

Trong `services/ai-service`, ngày 2026-09-25, chạy lại sau khi sửa guard SQL, schema tool, argument null, và budget compaction:

- `gofmt -l .`: không có file
- `go test -count=1 ./...`: PASS
- `go test -race -count=1 ./...`: PASS
- `go vet ./...`: PASS

Từ root repo:

- `node scripts/npm-run.js npx vitest run src/lib/ai/go-bff/__tests__/GoBffProtocolError.test.ts src/lib/ai/go-bff/__tests__/GoBffCanonicalRequest.test.ts`: PASS, 12 tests
- `node scripts/npm-run.js run verify:no-explicit-any`: PASS
- `node scripts/npm-run.js run verify:dedupe`: PASS
- `node scripts/npm-run.js run typecheck`: PASS
- `/usr/bin/openspec validate refactor-ai-into-shared-go-service --strict`: PASS

`golang.org/x/text v0.26.0` được đưa lên require trực tiếp cho chuẩn hóa intent. Các pin Go 1.24.0, toolchain go1.26.5, eino v0.9.21, openai adapter v0.1.13, gemini v0.1.36, và genai v1.70.0 không đổi.

## Review follow-up 2

Bốn finding Important được xử lý trước khi chấp nhận Phase 2:

- Guard SQL không còn coi identifier trong ngoặc kép là literal. `"public"`, `"set_config"(` và `SELECT … INTO TEMP/TEMPORARY/UNLOGGED` bị từ chối. Chuỗi trong ngoặc đơn vẫn không bị hiểu là từ khóa.
- Mọi quan hệ `ai_readonly.*` và mọi đích `FROM`/`JOIN` phải là view đã duyệt (`equipment_search`, `maintenance_facts`, `repair_facts`, `usage_facts`, `quota_facts`) hoặc CTE không có schema. `ai_readonly.internal_view` có test riêng.
- Argument `null` không panic. Mười catalog tool đều trả lỗi request. `categorySuggestion` thiếu `device_name` bị từ chối trước broker.
- Schema tham số được gắn vào tool Eino và được kiểm tra trên server: đúng field, kiểu, giới hạn, và không nhận field lạ. `query_database` bắt buộc `sql` và `reasoning`. `p_don_vi`/`p_user_id` vẫn do server ghi đè.
- Budget compaction đo history sau khi bỏ `uiArtifact`. Clarification cơ sở và clarification intent trả về trước gate đó.

`p_sql_shape` vẫn là câu SQL đã chuẩn hóa khoảng trắng và cắt tối đa 1000 ký tự. Đó là shape literal đã sanitize, không phải hash và không phải bản xóa literal. Audit DB giữ shape đó vì spec yêu cầu shape; operational log vẫn không ghi SQL. Đây không phải blocker riêng.

Lỗi executor lạ được đổi thành `SQLError` mã `execution_error` và câu cố định trước khi rời tool. Chuỗi driver không còn trong `Error()`. Hủy context vẫn trả lỗi context. Audit vẫn ghi `execution_error`.

Response đã nhận của ingress dùng Vercel AI SDK UI Message Stream v1, header `x-vercel-ai-ui-message-stream: v1`, gồm `text-delta`, tool input/output, `errorText` đã làm sạch, `finish` và `[DONE]`. `/api/chat` không gọi encoder này.

Ở `b10d8595`, `SessionSettings` và `LimitedStatement` mới là helper được test, chưa có executor gọi chúng. Follow-up 3 bổ sung `SQLExecutor` để áp dụng các settings và câu `LIMIT 101` trong transaction; test driver giả quan sát đường thực thi thật qua `database/sql`. Role `ai_query_tool` vẫn là SQL change riêng.

Budget ngữ cảnh cộng dồn vẫn thuộc Phase 3. Không bỏ `uiArtifact` của lượt hiện tại.

## Review follow-up

`post_implementation_reviewer` đối chiếu base `ac1599c378a6162b3fd0e2262d891b80827d67fa` và acceptance Phase 2. Không có Critical. Hai Important đã được sửa trong working tree trước commit:

- Tool catalog không còn nén mất evidence của lượt hiện tại. `deviceQuotaLookup` giữ `status`/`quota` trong `uiArtifact`; `equipmentLookup` giữ dòng đầy đủ ở `uiArtifact` và follow-up id/mã/tên. `query_database` trả envelope, gồm chart khi dòng là báo cáo nhóm. Lịch sử thì bỏ `uiArtifact`.
- `p_user_id` là JSON string. Test chat path khóa `"p_user_id":"42"` và không khóa số trần.

Các finding cũ về schema đối số và lỗi executor đã được xử lý ở follow-up; không còn coi chúng là residual.

## Review follow-up 3

Các blocker được xử lý trong working tree sau review b10d8595:

- Guard từ chối relation list dạng comma trong `FROM` và Unicode escaped identifier `U&"..."`; danh sách cột, CTE, hàm và `IN (...)` hợp lệ vẫn có regression test. Explicit `JOIN` giữa các quan hệ đã duyệt vẫn được phép. Đây là tập cú pháp giới hạn, không phải full PostgreSQL parser.
- Timeout do query con được audit failure khi request cha còn sống; cancellation của request cha trả đúng `context.Canceled`/`context.DeadlineExceeded`, không trả raw driver error và không trả rows.
- Thêm `SQLExecutor` dùng `database/sql` được inject: transaction read-only, kiểm tra `current_user = ai_query_tool` và `transaction_read_only = on`, áp dụng `SessionSettings`, `LimitedStatement` (`limit 101`), row/payload cap và redacted error. Driver giả chứng minh các nhánh này; không mở DB thật.

Bằng chứng RED: trên implementation `b10d8595`, regression cho comma relation list thất bại vì query được nhận; regression timeout thất bại với `context deadline exceeded` thay vì lỗi đã sanitize/audit; regression cancellation thất bại với `driver secret`. Sau sửa, các ca đó PASS. `executor_test.go` kiểm tra thứ tự settings trước query, role sai, transaction không read-only, setting failure, rollback và giới hạn rows/payload. `query_cancellation_test.go` kiểm tra cancellation trong lúc executor chạy và timeout bọc driver message. Không dùng lỗi compile làm bằng chứng RED hành vi.

### Deferred boundary phải giữ nguyên

- Provisioning role/connection `ai_query_tool`, audit RPC/schema và mọi migration/DDL là SQL change riêng, chưa bật query tool trên môi trường thật.
- Cumulative model-context budget qua nhiều tool step thuộc Phase 3; không bỏ `uiArtifact` của lượt hiện tại để né giới hạn.
- `src/app/api/chat/route.ts` production không đổi; chưa deploy, cutover, Cloudflare/Tunnel, live DB write hoặc paid-provider smoke.
- Encoder UI Message Stream v1 hiện chỉ khóa contract local cho ingress; chưa là bằng chứng cutover production hoặc hoàn tất task Phase 4.
- Literal trong `p_sql_shape` vẫn được giữ theo quyết định đã chốt: normalized shape tối đa 1000 ký tự trong audit DB; operational log chỉ ghi request id/error class.

Mốc xử lý và điều kiện chặn của từng hạng mục nằm trong bảng boundary ở `handoff.md`. Acceptance chỉ bao phủ local/mock hiện tại; không suy ra full parser, driver PostgreSQL, quyền DB thật hoặc stream production đã được chứng nhận.

## Chưa làm

Phase 3 trở đi chưa bắt đầu và chưa được tick. Chưa chuyển repair-draft orchestration, chưa chạy secondary extraction, chưa gọi `ai_quota_reserve` / `ai_quota_finalize` trên chat path, chưa kill-switch, chưa status quota mới, chưa DDL. Task 4.x và 5.x không được tick dù ingress HMAC/stream đã có bản local để khóa contract Phase 2. Vector HMAC dùng secret test, không ghi vào env production.
