# Assistant Provider Cutover Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe `google|groq` provider selection for assistant chat, keep one active provider per deployment, and document Vercel cutover/rollback without introducing cross-provider fallback.

**Architecture:** Keep model creation and key rotation in the provider layer, extract provider-specific route options into a small helper so the chat route stays mostly provider-agnostic, and preserve current Google behavior while adding Groq support behind `AI_PROVIDER`. Execute in strict TDD order: failing test first, verify red, minimal implementation, verify green, then small cleanup.

**Tech Stack:** Next.js 15 route handlers, TypeScript, Vercel AI SDK 6, `@ai-sdk/google`, `@ai-sdk/groq`, Vitest, npm

---

## Chunk 1: File Map and Dispatch Matrix

### Planned File Structure

**Modify**
- `package.json`
- `package-lock.json`
- `src/lib/ai/provider.ts`
- `src/app/api/chat/route.ts`
- `src/lib/ai/errors.ts`
- `.env.example`
- `src/lib/ai/__tests__/provider.test.ts`
- `src/lib/ai/__tests__/errors.test.ts`

**Create**
- `src/lib/ai/chat-provider-options.ts`
- `src/app/api/chat/__tests__/route.provider-selection.test.ts`
- `docs/ai/assistant-provider-cutover.md`

**Update only if assertions break after the route refactor**
- `src/app/api/chat/__tests__/route.key-rotation.test.ts`
- `src/app/api/chat/__tests__/route.error-safety.test.ts`

### Why This Split

- `src/app/api/chat/route.ts` is already 343 lines, near the repo's extraction threshold, so provider-specific option selection must move into a helper instead of growing the route further.
- `src/app/api/chat/__tests__/route.key-rotation.test.ts` is already 502 lines, so new provider-selection behavior belongs in a new test file instead of extending that file.
- Provider selection, route isolation, and operations/docs are separate responsibilities and should be reviewed independently.

### Subagent Dispatch Matrix

**Task 1 implementer**
- Scope: dependency install, provider selection, active-provider key loading, provider tests
- Write scope: `package.json`, `package-lock.json`, `src/lib/ai/provider.ts`, `src/lib/ai/__tests__/provider.test.ts`
- Model: `gpt-5.4-mini`
- Start condition: immediately after this plan is approved

**Task 2 implementer**
- Scope: route isolation, provider-option helper, route tests
- Write scope: `src/lib/ai/chat-provider-options.ts`, `src/app/api/chat/route.ts`, `src/app/api/chat/__tests__/route.provider-selection.test.ts`, plus existing route tests only if required
- Model: `gpt-5.4`
- Start condition: only after Task 1 is green and both reviews pass

**Task 3 implementer**
- Scope: quota detection tuning, env docs, cutover playbook, final verification
- Write scope: `src/lib/ai/errors.ts`, `src/lib/ai/__tests__/errors.test.ts`, `.env.example`, `docs/ai/assistant-provider-cutover.md`
- Model: `gpt-5.4-mini`
- Start condition: only after Task 2 is green and both reviews pass

### Review Pipeline Per Task

- Implementer subagent completes one task and reports `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, or `NEEDS_CONTEXT`.
- Spec reviewer verifies the actual code matches the task and did not add scope.
- Code-quality reviewer runs after spec approval only.
- Do not start the next implementation task until both review stages approve the current one.

## Chunk 2: Task 1 - Provider Selection and Key Pools

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/ai/provider.ts`
- Test: `src/lib/ai/__tests__/provider.test.ts`

- [ ] **Step 1: Write the failing provider tests**

Add focused tests in `src/lib/ai/__tests__/provider.test.ts` for:
- Groq provider selection when `AI_PROVIDER=groq`
- Groq model selection from `GROQ_MODEL`
- Groq key pool precedence: `GROQ_API_KEYS` before `GROQ_API_KEY`
- Rotation staying inside the active Groq pool
- Google behavior remaining unchanged, including model selection from `GOOGLE_GENERATIVE_AI_MODEL`
- Unsupported-provider rejection staying explicit for values outside `google|groq`

Add concrete expectations like:

```ts
it('returns a Groq model using the current Groq key from the pool', () => {
  process.env.AI_PROVIDER = 'groq'
  process.env.GROQ_MODEL = 'llama-3.3-70b-versatile'
  process.env.GROQ_API_KEYS = 'GROQ_A,GROQ_B'
  _internals.keys = ['GROQ_A', 'GROQ_B']

  const { model, keyIndex } = getChatModel()
  const m = model as { apiKey: string; modelId: string }

  expect(m.apiKey).toBe('GROQ_A')
  expect(m.modelId).toBe('llama-3.3-70b-versatile')
  expect(keyIndex).toBe(0)
})
```

- [ ] **Step 2: Run the provider tests and verify RED**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/provider.test.ts
```

Expected:
- FAIL on the new Groq-selection assertions because `groq` is still unsupported in the provider switch
- Existing Google tests may still pass

- [ ] **Step 3: Install the Groq SDK dependency**

Run:

```bash
npm install @ai-sdk/groq
```

Expected:
- `package.json` and `package-lock.json` updated
- No other dependency changes

- [ ] **Step 4: Implement the minimal provider changes**

In `src/lib/ai/provider.ts`:
- import Groq provider factory
- replace Google-only env loading with active-provider-aware loading
- load provider-specific model configuration instead of a shared model fallback
- keep the existing `_internals` structure so route code does not change shape
- keep `handleProviderQuotaError()` provider-agnostic and scoped to active keys only
- keep unsupported-provider error behavior explicit
- fail fast for unsupported providers and invalid provider/model configuration

Implementation target:

```ts
const provider = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase()

switch (provider) {
  case 'google': { /* existing path */ }
  case 'groq': { /* create Groq provider bound to current Groq key */ }
  default:
    throw new Error(`Unsupported AI provider: ${provider}`)
}
```

- [ ] **Step 5: Run the provider tests and verify GREEN**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/provider.test.ts
```

Expected:
- PASS for new Groq coverage
- PASS for existing Google coverage

- [ ] **Step 6: Run a narrow regression check**

Run:

```bash
npm run test:run -- src/app/api/chat/__tests__/route.key-rotation.test.ts
```

Expected:
- PASS without route changes
- Confirms provider return shape stayed compatible

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add package.json package-lock.json src/lib/ai/provider.ts src/lib/ai/__tests__/provider.test.ts
git commit -m "feat(ai): add groq provider selection"
```

## Chunk 3: Task 2 - Route Isolation for Provider-Specific Options

**Files:**
- Create: `src/lib/ai/chat-provider-options.ts`
- Modify: `src/app/api/chat/route.ts`
- Test: `src/app/api/chat/__tests__/route.provider-selection.test.ts`
- Update if needed: `src/app/api/chat/__tests__/route.key-rotation.test.ts`
- Update if needed: `src/app/api/chat/__tests__/route.error-safety.test.ts`

- [ ] **Step 1: Write the failing route tests**

Create `src/app/api/chat/__tests__/route.provider-selection.test.ts` with focused cases for:
- Google requests include Google-only provider options
- Groq requests do not include `providerOptions.google`
- route logs the active provider with the model on attempt start
- invalid `AI_PROVIDER` returns an explicit provider configuration error instead of the generic exhausted-keys fallback

Add concrete assertions like:

```ts
expect(streamTextMock).toHaveBeenCalledWith(
  expect.objectContaining({
    providerOptions: expect.objectContaining({
      google: expect.any(Object),
    }),
  }),
)

expect(streamTextMock).toHaveBeenCalledWith(
  expect.not.objectContaining({
    providerOptions: expect.objectContaining({
      google: expect.anything(),
    }),
  }),
)
```

- [ ] **Step 2: Run the new route test and verify RED**

Run:

```bash
npm run test:run -- src/app/api/chat/__tests__/route.provider-selection.test.ts
```

Expected:
- FAIL because the helper file does not exist and the route still hardcodes Google options

- [ ] **Step 3: Implement the helper with minimal behavior**

Create `src/lib/ai/chat-provider-options.ts` with one responsibility:
- read the active provider name
- return the configured model string for logging
- return provider-specific `providerOptions` only when applicable

Keep the interface small, for example:

```ts
export function getChatProviderOptions(): {
  provider: string
  configuredModel: string
  providerOptions?: Record<string, unknown>
}
```

- [ ] **Step 4: Refactor the route to use the helper**

In `src/app/api/chat/route.ts`:
- remove direct `GoogleLanguageModelOptions` usage from the route body
- import the helper
- use helper output for `configuredModel`, `provider`, and `providerOptions`
- extend chat diagnostics to include `provider` in attempt-start, quota, and pre-stream error logs
- make unsupported-provider configuration surface explicitly through the route, even when the active key pool is empty
- keep streaming, quota handling, tools, and usage metering unchanged

- [ ] **Step 5: Run route tests and verify GREEN**

Run:

```bash
npm run test:run -- src/app/api/chat/__tests__/route.provider-selection.test.ts src/app/api/chat/__tests__/route.key-rotation.test.ts src/app/api/chat/__tests__/route.error-safety.test.ts
```

Expected:
- PASS for new provider-selection tests
- PASS for existing route quota/error behavior

- [ ] **Step 6: Refactor only if still green**

If `route.ts` grew beyond the extraction threshold, move only provider-selection code into the helper and leave request-flow logic in `route.ts`.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add src/lib/ai/chat-provider-options.ts src/app/api/chat/route.ts src/app/api/chat/__tests__/route.provider-selection.test.ts src/app/api/chat/__tests__/route.key-rotation.test.ts src/app/api/chat/__tests__/route.error-safety.test.ts
git commit -m "refactor(ai): isolate chat provider options"
```

## Chunk 4: Task 3 - Error Patterns, Env Docs, and Cutover Playbook

**Files:**
- Modify: `src/lib/ai/errors.ts`
- Test: `src/lib/ai/__tests__/errors.test.ts`
- Modify: `.env.example`
- Create: `docs/ai/assistant-provider-cutover.md`

- [ ] **Step 1: Write the failing quota-pattern tests**

Extend `src/lib/ai/__tests__/errors.test.ts` with Groq-flavored quota/rate-limit messages that should be recognized as provider quota errors and sanitized into the existing provider quota message.

Add concrete cases like:

```ts
expect(
  isProviderQuotaError(new Error('Rate limit reached for model in organization org_123'))
).toBe(true)

expect(
  sanitizeErrorForClient('Rate limit reached for model in organization org_123')
).toContain('Model AI đang vượt hạn mức sử dụng của nhà cung cấp.')

expect(isProviderQuotaError(new Error('Network timeout while contacting Groq'))).toBe(false)
```

- [ ] **Step 2: Run the error tests and verify RED**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/errors.test.ts
```

Expected:
- FAIL on new Groq quota-pattern cases

- [ ] **Step 3: Implement the minimal error-pattern expansion**

In `src/lib/ai/errors.ts`:
- add only the minimum additional patterns needed for Groq rate-limit/quota detection
- do not broaden matching so far that generic network errors become quota errors

- [ ] **Step 4: Update configuration docs**

Update `.env.example` with:
- `AI_PROVIDER=google`
- `GOOGLE_GENERATIVE_AI_MODEL`
- Google key envs
- `GROQ_MODEL`
- Groq key envs
- comment stating only one provider is active per deployment

Create `docs/ai/assistant-provider-cutover.md` with:
- required env vars for Google and Groq
- Vercel cutover steps
- smoke-test checklist after deploy
- rollback steps back to Google
- log lines to confirm active provider/model

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/errors.test.ts
npm run typecheck
```

Expected:
- PASS for updated error tests
- PASS for whole-project typecheck

- [ ] **Step 6: Run end-to-end targeted assistant verification**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/provider.test.ts src/lib/ai/__tests__/errors.test.ts src/app/api/chat/__tests__/route.provider-selection.test.ts src/app/api/chat/__tests__/route.key-rotation.test.ts src/app/api/chat/__tests__/route.error-safety.test.ts
```

Expected:
- PASS for all provider and route-focused tests

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add src/lib/ai/errors.ts src/lib/ai/__tests__/errors.test.ts .env.example docs/ai/assistant-provider-cutover.md
git commit -m "docs(ai): add provider cutover playbook"
```

## Chunk 5: Final Integration and Deployment Gate

### Production Cutover Checklist

- [ ] Confirm Google remains the default in `.env.example` until Groq smoke tests are approved.
- [ ] Set `AI_PROVIDER=groq` only on the target Vercel environment being evaluated.
- [ ] Set `GROQ_MODEL` to the selected Groq model and configure `GROQ_API_KEY` or `GROQ_API_KEYS`.
- [ ] Redeploy and capture `/api/chat` logs that include `provider`, `model`, `attempt`, and `keyIndex`.
- [ ] Send at least two production-like chat prompts: one plain response and one tool-using prompt.
- [ ] If Groq fails smoke checks, revert `AI_PROVIDER=google`, restore Google key envs if needed, and redeploy without code changes.

### Final Review Gate

- [ ] Dispatch final code reviewer after Task 3 is merged.
- [ ] Run `git pull --rebase`.
- [ ] Run `bd sync` if available; if not, record `command not found` in the handoff notes and continue with the remaining release checks.
- [ ] Run `git push`.
- [ ] Run `git status --short --branch` and confirm the implementation branch is clean and up to date with origin.
- [ ] Land using the repo's standard finish flow only after tests, reviews, and deployment smoke checks are complete.
