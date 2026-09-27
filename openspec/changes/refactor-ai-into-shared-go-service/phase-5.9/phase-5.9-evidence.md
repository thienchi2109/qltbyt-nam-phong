# Phase 5.9 Evidence

Ngày: 2026-09-27  
Base commit: `7a2a593ebe1231a70b4751a4e126d435cb0ae916`  
Phạm vi: 5.9.1–5.9.5 provider adapter/fallback contract trên dark Go path; không cutover route, không Phase 6, không DB/RPC/schema và không dùng credentials thật.

Review-fix state: working tree chưa commit; commit landed sau lượt review phải thay thế base/evidence identity trước khi closeout.

## Implementation

- `internal/provider/model.go` giữ Eino `model.ToolCallingChatModel` và `schema.StreamReader`, map chunk/usage/tool-call thành normalized adapter events, giữ message chunks đi kèm terminal stream error và bọc provider errors typed.
- `internal/provider/errors.go` phân loại quota exhaustion/rate limit ở adapter boundary bằng các field typed của Eino OpenAI `APIError` (`HTTPStatusCode`, `Code`, `Type`, `HTTPStatus`) và Gemini `genai.APIError` (`Code`, `Status`), rồi bọc bằng `ProviderError`; HTTP 401/403, 5xx, timeout/cancellation và raw message không được fallback. Orchestration chỉ nhận marker typed qua `protocol.IsProviderFallbackEligible`.
- `internal/provider/chain.go` định nghĩa `ProviderModelPair`, capability/context/tool-schema/policy profile, ordered priority chain và hard ceiling hai attempts. Chuỗi được duyệt là NVIDIA `google/gemma-4-31b-it` → Google `gemini-3.5-flash-lite`.
- `internal/provider/config.go` parse explicit `AI_PROVIDER_CHAIN` và đọc secret từ provider-specific environment; chỉ chấp nhận đúng ordered pair NVIDIA `google/gemma-4-31b-it` → Google `gemini-3.5-flash-lite`, đồng thời kiểm tra pair/config model compatibility trước khi mở adapter.
- `internal/orchestration/runner.go` giữ Eino tool loop/stream/cancellation; lỗi quota/rate-limit typed trong `ChatModel` acquisition cũng đi qua pre-stream fallback. Fallback chỉ được gọi khi chưa emitted và adapter marker typed cho phép, không đổi provider sau stream start; mọi Eino stream chunk non-nil, kể cả role/usage-only, khóa fallback. Result/event metadata chỉ chứa provider/model/outcome/attempt class; terminal typed quota/rate-limit class được giữ nguyên thay vì ghi đè `provider_failure`.
- `internal/orchestration/runner_helpers.go` chứa các helper generation/stream/finalization/configuration để `runner.go` giữ dưới ngưỡng 350 dòng mà không thay đổi ownership của Eino loop.
- Existing Google key-pool rotation remains intact; pair fallback is separate and has no cooldown, circuit breaker or weighted routing.

## Acceptance tests

- `TestFallbackPrimarySuccessUsesOnlyPrimary`: primary success, fallback not called.
- `TestFallbackQuotaBeforeStreamUsesNextPairOnce`: typed quota exhaustion before output advances once and records both attempts.
- `TestFallbackMidStreamFailureDoesNotSwitch`: output then provider failure leaves active pair unchanged.
- `TestFallbackConfigFailsClosed`: empty chain, duplicate priority, incompatible capability profile, missing secret and invalid ceiling reject.
- `TestChainConfigFromEnvRejectsUnapprovedProviderModelPairs`: arbitrary model/provider order and unapproved model IDs reject before chain construction.
- `TestFallbackAttemptCeilingIsTwo`: three-pair/three-attempt chain rejects.
- `TestNormalizeEventKeepsUsageAndTypedErrorRedacted`: normalized text/usage and sanitized error do not expose raw cause.
- `TestDefaultAttemptLimitAndRateLimitMetadata`: omitted ceiling normalizes to two attempts and preserves the typed rate-limit class in redacted attempt metadata.
- `TestProviderFallbackRetriesQuotaDuringModelAcquisition`: typed quota from `ChatModel` acquisition advances to the next approved pair before any Eino output.
- `TestProviderFallbackPreservesTerminalQuotaClass`: terminal quota failure keeps `quota-exhausted` in the second redacted attempt.
- `TestProviderFallbackDoesNotSwitchAfterUsageOnlyStreamEvent`: a non-content Eino stream chunk with role/usage marks the stream emitted and blocks fallback.
- `TestProviderFallbackRequiresTypedError`: raw `429`/quota text is rejected by the protocol fallback predicate.
- `TestProviderFallbackAttributesAttemptsAndUsage`: Eino runner aggregates both provider attempts and preserves partial usage semantics.
- `TestReviewDynamicHTTPClassification`: local HTTP RED reproduced the auth error containing `quota` as an incorrect fallback (`401`, fallback calls `1`, first attempt `quota-exhausted`); GREEN covers typed `insufficient_quota` and `rate_limit_exceeded` positives plus `401`, `403`, `500` and timeout quota-like negatives. Positives call fallback once with the expected typed class; negatives keep fallback calls at `0` and the primary attempt as `transport` failure.
- `TestClassifyTypedProviderErrors`: direct OpenAI/Gemini typed fields, auth/server quota-like payloads, raw quota text and deadline cancellation retain the expected neutral class.
- Existing provider transport, quota rotation and orchestration regression suites remain green.

## Verification

- `go test ./internal/provider ./internal/orchestration ./internal/protocol` — PASS.
- `go test -race ./internal/provider ./internal/orchestration ./internal/protocol` — PASS.
- `go test ./...` from `services/ai-service` — PASS.
- `go test ./...` includes the acquisition, terminal metadata and metadata-only stream regressions above.
- `go vet ./...` from `services/ai-service` — PASS.
- `test -z "$(gofmt -l internal)"` — PASS.
- RED: `go test ./internal/orchestration -run '^TestReviewDynamicHTTPClassification$' -count=1 -v` failed only `auth_mentions_quota` because the pre-fix raw-text classifier made `fallback=1` (wanted `0`).
- GREEN: the expanded dynamic test passed with `real_quota` `fallback=1`/`quota-exhausted`, `real_rate_limit` `fallback=1`/`rate-limited`, and `401`/`403`/`500`/timeout `fallback=0`/`transport`; provider attempt metadata matched each outcome.
- `go test ./internal/provider -run '^TestClassifyTypedProviderErrors$' -count=1 -v` — PASS.
- Official Gemini docs fetched before implementation through context-mode: streaming, text generation, function calling and API keys. The Go implementation keeps the maintained Eino Gemini adapter; Phase 5.9 provider smoke remains fake-only.

## Search and scope evidence

- Code Deduplication search used Code Review Graph semantic search and GitNexus context/impact. Existing reusable behavior was the Google key pool and Eino model loop; the new pair chain stays in `internal/provider` and reuses those primitives rather than adding a second model/tool loop.
- Code Review Graph was refreshed at this exact base commit; untracked new files were not indexed by the graph and were verified by direct `rg` and focused tests.
- No API key, prompt, model output, raw provider payload or live endpoint response is stored in this artifact.

## Deferred boundary

No production `/api/chat` cutover, Phase 6 container/Tunnel work, VM/live-provider smoke, circuit breaker/cooldown, weighted routing, database/RPC/schema change or credential deployment is included.
