# System Prompt Changelog

## Versioning Rules

- `major`: safety model, permission policy, or tenant-boundary policy changes.
- `minor`: new behavior blocks or expanded assistant capabilities.
- `patch`: wording or clarity updates that do not change policy behavior.

## Required Tests Per Change

- Prompt tests in `src/lib/ai/prompts/__tests__/system.test.ts` must pass.
- Route tests must confirm `/api/chat` consumes `buildSystemPrompt(...)` from prompt module.

## Entry Format

```text
## vX.Y.Z - YYYY-MM-DD
- Change summary:
  - ...
- Rationale:
  - ...
- Required verification:
  - node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts"
  - node scripts/npm-run.js run typecheck
```

## Entries

## v1.0.0 - 2026-03-02
- Change summary:
  - Introduced a versioned system prompt module with explicit policy sections.
  - Added explicit Fact vs Inference vs Draft response contract language.
  - Added constraints for read-only behavior, tenant safety, and no user-upload/multimodal input.
- Rationale:
  - Make prompt behavior explicit, testable, and easy to evolve safely over time.
- Required verification:
  - node scripts/npm-run.js run test:run -- "src/lib/ai/prompts/__tests__/system.test.ts"
  - node scripts/npm-run.js run typecheck
