# Phase 5.9 Handoff

Ngày: 2026-09-27  
Base commit: `7a2a593ebe1231a70b4751a4e126d435cb0ae916`

Review-fix state: working tree chưa commit; maintainer phải cập nhật commit identity sau khi land.

Phase 5.9.1–5.9.5 is implemented in the dark Go provider/orchestration boundary. The Eino model/tool loop remains the owner of generation, tool execution, stream events and cancellation. The adapter wraps Eino transports, normalizes usage/errors and exposes only typed fallback eligibility. The ordered pair chain is NVIDIA `google/gemma-4-31b-it` followed by Google Gemini `gemini-3.5-flash-lite`; each pair is attempted once and the request stops at two attempts.

The deterministic evidence is in [phase-5.9-evidence.md](phase-5.9-evidence.md). Focused provider/orchestration/protocol tests, race tests, full module tests, vet and formatting checks pass. Fallback eligibility is typed-only; legacy raw-string fakes were updated to typed adapter errors. No credentials were used or committed.

Review findings were addressed before handoff: `ChainConfigFromEnv` and `validateChain` now fail closed to the approved NVIDIA `google/gemma-4-31b-it` -> Google `gemini-3.5-flash-lite` pair and matching adapter config; typed quota/rate-limit errors from Eino model acquisition can retry before output; terminal attempt metadata retains the typed class; the Eino adapter preserves message chunks even when a terminal stream error accompanies the chunk; every non-nil Eino stream chunk, including role/usage-only chunks, blocks provider switching; HTTP provider classification now uses Eino OpenAI/Gemini SDK fields so quota-like auth, 5xx and timeout payloads never trigger fallback; and generation/stream/finalization helpers were extracted so `runner.go` is 225 lines.

The review-fix RED/GREEN proof is in [phase-5.9-evidence.md](phase-5.9-evidence.md): the old dynamic local HTTP test reproduced a `401` message containing `quota` as an incorrect fallback, and the expanded six-case test now records the expected fallback calls and typed attempt classes for quota, rate-limit, auth, server and timeout responses.

The next review boundary is dark evidence review. Phase 6 operations, paid-provider smoke and production routing remain deferred; no live write or cutover authorization is implied by this handoff.
