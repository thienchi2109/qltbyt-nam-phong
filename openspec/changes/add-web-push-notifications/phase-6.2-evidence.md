# Phase 6.2 Evidence

## Scope

Chunk 6.2 hardens provider delivery only: HTTPS endpoint validation, DNS resolution and IP pinning, SSRF range rejection, redirect/proxy controls, payload/TTL bounds, and provider outcome mapping.

## Implementation

- Commit: `e47eb510`.
- Endpoint validation rejects non-HTTPS, userinfo, fragments, non-443 ports, oversized URLs, and unsafe literal addresses.
- DNS answers are parsed with `netip`, validated per send, and pinned to the connection while preserving hostname/SNI and query.
- Private, link-local, multicast, unspecified, mapped, CGNAT, reserved, documentation, benchmark, and translation ranges are rejected; ordinary public IPv4/IPv6 remain supported.
- Redirects and environment proxies are disabled. Payload, encrypted record, and TTL bounds are enforced before send.
- Provider statuses map to `accepted`, `endpoint_gone`, `transient`, `credential_error`, or `permanent`.

## Verification

- RED -> GREEN regressions cover reserved ranges, IPv4-mapped addresses, public IPv4/IPv6 literals and DNS answers, DNS-per-send, IP pinning, SNI/query preservation, redirects, proxy environment, payload/TTL limits, timeout and status mapping.
- `go test ./... -count=1`: PASS.
- `go test -race ./...`: PASS.
- `go vet ./...`: PASS.
- `golangci-lint run ./...`: PASS (0 issues).
- `gofmt` and `git diff --check`: PASS.

## Limits

No production provider send, browser smoke, Docker/ops packaging, SQL/live DB write, or deployment was performed. Chunks 6.3-6.5 remain deferred.
