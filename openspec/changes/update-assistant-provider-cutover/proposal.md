## Why
The AI assistant is currently hard-wired to Google in the application code, and recent production incidents showed that provider-specific instability can take the chat experience down quickly. We need a safer path to evaluate Groq without introducing a full multi-provider runtime architecture.

## What Changes
- Add configuration-level support for `google` and `groq` as chat providers, while keeping exactly one active provider per deployment.
- Refactor the assistant provider boundary so provider-specific SDK setup lives in the provider layer instead of leaking Google-only options into the generic chat route.
- Add Groq-specific environment variables and model selection documentation alongside the existing Google configuration.
- Preserve existing key-pool rotation only within the active provider; this change explicitly does **not** add cross-provider fallback in the same request.
- Define an operational cutover and rollback playbook for switching production deployments between Google and Groq on Vercel.

## Impact
- **Affected Specs**: `assistant-provider-selection` (new capability)
- **Affected Code**:
  - `package.json`
  - `src/lib/ai/provider.ts`
  - `src/app/api/chat/route.ts`
  - `src/lib/ai/errors.ts`
  - `.env.example`
  - `src/lib/ai/__tests__/provider.test.ts`
  - `src/app/api/chat/__tests__/*`
