# Jev proof of concept

This repository keeps deterministic checks (formatting, typecheck, SQL quality gates, and tests) in control. Jev is used only for an explicitly enabled, manual decision after staging a SQL migration diff:

```sh
JEV_MODE=enabled node scripts/jev-change-risk.mjs
```

The script sends one `Choice` and one `Score` in a single System One request. It reports the route, probabilities, and confidence; maintainers still make the final decision. Without `JEV_MODE=enabled`, it exits without a network call. `JEV_MONTHLY_CALL_CAP` defaults to 4 and `.jev-usage.json` records the current-month call count (ignored by Git).

Expected usage is zero during ordinary development and at most four calls per month when deliberately invoked. This is suitable for a roughly $5/month early-access budget; do not put it in CI or a per-request path.

The official JavaScript SDK is `@typesafe-ai/sdk` and reads `TYPESAFE_API_KEY` from the environment. Never commit that key.
