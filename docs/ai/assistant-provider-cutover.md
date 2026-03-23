# Assistant Provider Cutover Playbook

This playbook covers switching the assistant between Google Gemini and Groq in Vercel while keeping the deployment in a single-active-provider configuration.

## Required Environment Variables

### Google Gemini

Set these when `AI_PROVIDER=google`:

- `AI_PROVIDER=google`
- `GOOGLE_GENERATIVE_AI_MODEL=gemini-3-flash-preview` or another approved Gemini model
- `GOOGLE_GENERATIVE_AI_API_KEY=<secret>`

If you use key rotation, populate `GOOGLE_GENERATIVE_AI_API_KEYS` with a comma-separated pool and leave the single-key variable empty.

### Groq

Set these when `AI_PROVIDER=groq`:

- `AI_PROVIDER=groq`
- `GROQ_MODEL=llama-3.3-70b-versatile` or `llama-3.1-8b-instant`
- `GROQ_API_KEY=<secret>`

Groq production deployments should use supported production models only. Do not use preview Groq models for production traffic.

If you use key rotation, populate `GROQ_API_KEYS` with a comma-separated pool and leave the single-key variable empty.

### Safe single-provider rule

- Only one provider should be active in a given Vercel deployment.
- Do not leave both Google and Groq credentials populated in the same deployment unless you are intentionally using that environment as a non-production staging experiment.
- Keep `AI_PROVIDER` aligned with the provider-specific model and key variables.

## Vercel Cutover Steps

1. Decide the target provider and confirm the target model.
2. Update the Vercel environment variables for the target scope first, usually `Preview`.
3. Clear or blank the inactive provider variables in that same scope.
4. Redeploy the preview deployment.
5. Run the smoke tests below against the preview URL.
6. If the preview checks pass, apply the same environment changes to `Production`.
7. Redeploy production.
8. Verify the production logs show the new provider and model.

## Smoke Test Checklist After Deploy

- Open the app and send a short assistant prompt.
- Confirm the response streams normally and does not fail preflight.
- Check that the chat logs include `"[chat] Model attempt start"` with the expected `provider` and `model`.
- Confirm there is no `Unsupported AI provider` or `Missing Groq model configuration` error in the logs.
- If Groq rate limiting occurs, confirm the logs show `"[chat] Pre-stream quota error — rotating to next key"` or `"[chat] Stream quota error"` and that the response stays sanitized.
- If you see a bare `429 Too Many Requests`, investigate provider rate limiting alongside any app or gateway throttling before assuming a Groq org-level limit.
- If the provider error includes Groq-specific rate-limit wording, verify `retry-after` / `x-ratelimit-*` headers in the provider response path when available.

## Rollback to Google

1. Set `AI_PROVIDER=google` in the affected Vercel scope.
2. Restore `GOOGLE_GENERATIVE_AI_MODEL` and `GOOGLE_GENERATIVE_AI_API_KEY`.
3. Clear or blank the Groq variables in that scope.
4. Redeploy.
5. Run the same smoke tests.
6. Confirm the logs now show `provider: 'google'` and the expected Google model.

## Log Lines to Confirm Active Provider/Model

Watch for these log patterns from the chat route:

- `"[chat] Model attempt start"` with `provider` and `model`
- `"[chat] Pre-stream quota error — rotating to next key"`
- `"[chat] Stream quota error"`
- `"[chat] Provider configuration error"`

Example success log:

```text
[chat] Model attempt start { attempt: 1, maxAttempts: 1, keyIndex: 0, provider: 'groq', model: 'llama-3.3-70b-versatile' }
```

## Operational Notes

- Groq rate limits are organization-scoped, so one overloaded deployment or workload can affect every request in the org.
- The assistant code treats Groq quota/rate-limit responses as retryable key-rotation signals when a key pool exists.
- Keep the inactive provider’s key/model values empty in production to avoid accidental cross-provider drift.
