## 1. Provider Support
- [ ] 1.1 Install `@ai-sdk/groq` and update dependency metadata.
- [ ] 1.2 Extend `src/lib/ai/provider.ts` to support `AI_PROVIDER=google|groq`.
- [ ] 1.3 Add active-provider key loading for `GOOGLE_GENERATIVE_AI_API_KEY(S)` and `GROQ_API_KEY(S)`.
- [ ] 1.4 Keep API-key rotation scoped to the active provider only.

## 2. Chat Route Isolation
- [ ] 2.1 Refactor `src/app/api/chat/route.ts` so shared chat behavior stays provider-agnostic.
- [ ] 2.2 Apply Google-specific provider options only when Google is active.
- [ ] 2.3 Add Groq-compatible route behavior without introducing cross-provider fallback.

## 3. Error Handling and Observability
- [ ] 3.1 Review `src/lib/ai/errors.ts` quota/rate-limit detection for Groq responses.
- [ ] 3.2 Ensure chat diagnostics identify the active provider during cutover validation.

## 4. Configuration and Operations
- [ ] 4.1 Update `.env.example` with Groq configuration and the single-active-provider rule.
- [ ] 4.2 Document a Vercel cutover checklist: env changes, redeploy, smoke test, and rollback.

## 5. Verification
- [ ] 5.1 Add or update tests for provider selection and route behavior.
- [ ] 5.2 Run `npm run typecheck`.
- [ ] 5.3 Run targeted assistant/provider tests.
