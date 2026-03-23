## Context
The assistant chat flow currently assumes Google everywhere that matters: provider creation, environment variable loading, and provider-specific options in the route. The application already has rate limiting, usage metering, tool execution, streaming, and API-key rotation for the active provider, but it does not have a safe abstraction for changing providers at deployment time.

The goal is to make Groq a viable production option without turning the assistant into a dynamic multi-provider router. The safest change is to support multiple providers in code, but keep only one provider active in each deployment via environment configuration.

## Goals / Non-Goals
- Goals:
  - Support `AI_PROVIDER=google|groq` in the assistant provider layer.
  - Preserve existing chat behavior: streaming responses, tool usage, quota metering, and active-provider key rotation.
  - Remove Google-only provider options from the generic route path when Groq is active.
  - Provide an operator-focused cutover and rollback process for Vercel production deployments.
- Non-Goals:
  - No cross-provider fallback in the same request.
  - No load balancing or traffic splitting between Google and Groq.
  - No provider routing by prompt type, tool type, or tenant.
  - No replacement of the existing Google path during the first implementation.

## Decisions
- Decision: Use the first-party AI SDK Groq provider (`@ai-sdk/groq`) instead of the generic OpenAI-compatible adapter.
  - Rationale: The codebase already uses provider-specific AI SDK integrations, and first-party Groq support reduces compatibility surface area and avoids depending on Groq's "mostly compatible" OpenAI path for core chat traffic.
- Decision: Keep a single active provider per deployment, selected by `AI_PROVIDER`.
  - Rationale: This gives us a safe rollback path without adding the failure modes of in-request provider failover.
- Decision: Scope key loading and rotation to the active provider only.
  - Rationale: Existing key-rotation logic is valuable, but mixing providers in the same pool would complicate retry semantics, logging, and quota interpretation.
- Decision: Move provider-specific request options behind a provider-aware boundary.
  - Rationale: The route should remain responsible for shared assistant behavior, while provider-specific options such as Google thinking config should only apply when that provider is active.
- Decision: Treat cutover as both a code change and an operational change.
  - Rationale: Switching providers safely requires documented environment variables, deployment steps, smoke checks, and rollback instructions in addition to code support.

## Alternatives Considered
- Use Groq through `@ai-sdk/openai-compatible`.
  - Rejected for the first rollout: broader compatibility surface and weaker fit than the first-party Groq provider.
- Replace Google outright with Groq in a single cutover.
  - Rejected: too risky; removes the fastest rollback path if Groq behavior diverges under production tool traffic.
- Add full runtime fallback from Google to Groq.
  - Rejected: materially more complex retry, logging, and quota behavior than needed for this change.

## Risks / Trade-offs
- Supporting two providers in code increases the testing matrix, even though only one provider is active per deployment.
- Groq quota and rate-limit semantics may not match Google's error text exactly, so quota detection rules may need to expand.
- Tool-calling behavior can vary by model, so the initial Groq model choice should remain environment-configurable and be verified with production-like prompts before full cutover.

## Migration Plan
1. Add Groq SDK dependency and provider-specific environment variable support.
2. Refactor the provider layer to select Google or Groq from `AI_PROVIDER`.
3. Refactor the chat route so provider-specific options are only applied when relevant.
4. Extend tests to cover provider selection, active-provider key pools, and route behavior under Groq configuration.
5. Update environment documentation and add a production cutover/rollback checklist.
6. Cut over on Vercel by changing provider env vars and redeploying, then run smoke checks against production logs.
7. Roll back by restoring Google env vars and redeploying if Groq smoke checks fail.

## Open Questions
- Which Groq model should be the initial production default for tool-heavy assistant traffic? The implementation should keep this env-configurable rather than hard-coding it in the design.
