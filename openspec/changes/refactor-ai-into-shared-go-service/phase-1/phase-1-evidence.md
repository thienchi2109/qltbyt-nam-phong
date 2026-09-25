# Phase 1 Evidence

Ngày: 2026-09-25  
Nhánh: `feat/shared-ai-service-phase1`  
Base: `337d7dc4c522f19736911ee39d59dae374559469` (`main`)

Phase 1 chỉ thêm shared core app-neutral trong `services/ai-service`. Không có
QLTBYT adapter, HTTP/HMAC/SSE, container, deploy, live DB, migration/DDL, hay
paid-provider smoke. Các quyết định Phase 0 được giữ nguyên.

## Module và pin

- Module: `example.com/shared-ai-service`
- Language: `go 1.24.0`
- Toolchain đã pin: `go1.26.5` (đúng binary chạy test: `go version go1.26.5 linux/amd64`)
- Eino: `github.com/cloudwego/eino v0.9.21`
- Provider integrations Phase 0 giữ lại:
  - `github.com/cloudwego/eino-ext/components/model/openai v0.1.13` cho `gateway` và `openai-compatible`
  - `github.com/cloudwego/eino-ext/components/model/gemini v0.1.36` cùng `google.golang.org/genai v1.70.0` cho `google`
- Vercel không build module này: `vercel.json` và `package.json` không gọi module; không có workflow mới và không có workflow hiện hữu nào build `services/ai-service`.
- Không thêm CI platform.

## Hành vi được giữ

- Ba transport `gateway`, `google`, `openai-compatible`. Transport lạ, kể cả Bifrost, bị từ chối.
- Google key pool giữ key hiện tại cho tới quota error, rồi rotate đúng key đã fail, và xóa exhaustion một giờ sau lần mark đầu tiên.
- Gemini model id nhận thinking level `medium`. Stub Gemini local thấy `generationConfig.thinkingConfig.thinkingLevel = MEDIUM`.
- Gateway và openai-compatible đi qua Eino OpenAI adapter. Stub local kiểm tra base path riêng, `max_tokens`, `temperature`, stream SSE và `response_format.type = json_object` cho extraction.
- Tool loop dùng Eino `react.Agent`. Core không có vòng orchestration thứ hai.
- Text stream không tool đi qua `ChatModel.Stream`. Usage trong một stream lấy snapshot mới nhất khi tổng token không giảm, để không cộng dồn cumulative usage.
- Retry chỉ xảy ra trước khi có output, chỉ với quota error, và bị chặn bởi số key của pool. Mỗi provider call được observe trước finalize; `Attempts` là số call đó, không phải lúc nào cũng 1.
- Cancel sau khi provider đã bắt đầu finalize là `unknown`, không refund, không measured zero.
- Cancel trong tool dừng trước model call tiếp theo.
- Known zero có cả hai dimension bằng 0 và `measured`. Unknown/partial không được ghi thành measured zero. Partial giữ dimension đã biết.
- Finalize trước expiry là idempotent theo reservation ID. Cùng request ID không mở provider lần nữa, kể cả khi lần đầu refund vì provider chưa chạy. Finalize đúng hoặc sau reservation expiry (`>= 120s`) là `expired-uncertain`: không measured, không refund. Đây là giới hạn đã chấp thuận ngày 2026-09-25; mất accounting trước expiry không được chấp nhận.
- Clarification trả event và không reserve, không mở provider.
- Capability version không có thì lỗi `capability_unavailable`, không retry, không mở provider.
- Context display name và `identity.tenant` không được core dùng làm quota tenant. Usage contract không có field tenant.
- Provider SDK chỉ nằm trong `internal/provider`. Capability, registry, protocol, usage, orchestration và fixture second-app không import SDK đó.

## Kiểm tra

Trong `services/ai-service`, ngày 2026-09-25:

- `go test -count=1 ./...`: PASS, 24 tests
- `go test -race -count=1 ./...`: PASS
- `go vet ./...`: PASS
- `go mod verify`: PASS
- `gofmt -l .`: không có file
- `openspec validate refactor-ai-into-shared-go-service --strict`: PASS

## Chưa làm

Phase 2 trở đi chưa được triển khai và chưa được tick. Gateway OpenAI-compatible
chưa nhét thinking config vào JSON body vì Phase 0 chỉ chứng minh field đó trên
Gemini adapter và trên AI SDK provider options, không phải trên chat-completions
body. Endpoint gateway là cấu hình tường minh `AI_GATEWAY_BASE_URL`; thiếu
endpoint thì fail closed.
