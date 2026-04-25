# Default Chat Config Runbook

This runbook documents the env contract for switching the primary `default_chat` AI provider/model without editing route or business-logic code.

## Preferred Gateway Flow

Use Vercel AI Gateway as the preferred transport for `default_chat`.

Required env vars:

```env
AI_DEFAULT_CHAT_MODEL=google/gemini-3.1-flash-lite-preview
AI_GATEWAY_API_KEY=your_gateway_key
```

Optional explicit pin:

```env
AI_DEFAULT_CHAT_PROVIDER=gateway
```

`AI_DEFAULT_CHAT_PROVIDER` is an optional explicit pin. The current resolver already defaults to gateway when `AI_DEFAULT_CHAT_MODEL` is provider-prefixed and legacy Google env vars are not steering resolution into compatibility mode.

Model ids must use the format `<provider>/<model>`, for example:

- `google/gemini-3.1-flash-lite-preview`
- `openai/gpt-5.2`
- `anthropic/claude-sonnet-4`
- `mistral/mistral-large-3`

No AI base URL env var is required by the current implementation. Gateway transport is created internally and only needs `AI_GATEWAY_API_KEY`.

## Compatibility Flow: Direct Google

Keep the legacy direct Google path only for compatibility with older deployments or if you explicitly want Google API-key pool rotation.

Direct Google env vars:

```env
AI_PROVIDER=google
AI_MODEL=gemini-3.1-flash-lite-preview
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
GOOGLE_GENERATIVE_AI_API_KEYS=key_a,key_b,key_c
```

Notes:

- `GOOGLE_GENERATIVE_AI_API_KEY` is the single-key path.
- `GOOGLE_GENERATIVE_AI_API_KEYS` enables the direct Google key pool.
- Key-pool quota rotation applies only to direct Google mode, not gateway mode.
- Leaving legacy Google env vars in place can keep a deployment on the compatibility path instead of the preferred gateway path.

## Deployment Switch Flow

To switch the primary provider/model for `default_chat`:

1. Update `AI_DEFAULT_CHAT_MODEL` to the new provider-prefixed model id.
2. Ensure `AI_GATEWAY_API_KEY` is set for the target environment.
3. Remove or stop relying on legacy direct Google env vars if you want the deployment to resolve cleanly to gateway mode.
4. Redeploy.

You should not need to edit `src/app/api/chat/route.ts` or any business-logic file for a normal provider/model switch.

## Validation Failures And Fixes

| Error | Meaning | Fix |
|---|---|---|
| `AI_DEFAULT_CHAT_MODEL must be a provider-prefixed model id when provider is gateway` | Gateway mode was selected but the model id is missing the provider prefix. | Change the model to `<provider>/<model>`, for example `openai/gpt-5.2`. |
| `AI_GATEWAY_API_KEY is required for AI gateway mode` | Gateway mode resolved successfully but the gateway key is missing. | Set `AI_GATEWAY_API_KEY` in the deployment environment and redeploy. |
| `Unsupported direct AI provider: ... Use AI_DEFAULT_CHAT_PROVIDER=gateway with a provider-prefixed model id.` | A direct provider other than Google was configured via legacy env vars. | Move to the preferred gateway flow and use a provider-prefixed `AI_DEFAULT_CHAT_MODEL`. |
| `GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEYS is required for direct Google mode` | Direct Google compatibility mode resolved, but no Google API key is available. | Set one of the Google key env vars or remove the legacy direct Google settings so the deployment uses gateway mode instead. |

## Operational Default

For new or cleaned-up deployments, prefer:

```env
AI_DEFAULT_CHAT_MODEL=google/gemini-3.1-flash-lite-preview
AI_GATEWAY_API_KEY=your_gateway_key
AI_DEFAULT_CHAT_PROVIDER=gateway
```

Use the direct Google compatibility flow only when you intentionally need the old key-rotation path.
