# Phase 0.5 HMAC Parameters

Status: Phase 0 evidence and review complete; these values are normative for
the change, while Phase 1 still requires explicit user approval.

| Parameter                 | Value                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| MAC                       | HMAC-SHA-256                                                                             |
| Signature encoding        | Base64 URL encoding without padding (`base64.RawURLEncoding`)                            |
| Timestamp header          | `X-AI-Service-Timestamp`                                                                 |
| Request ID / nonce header | `X-AI-Service-Request-ID`                                                                |
| Key ID header             | `X-AI-Service-Key-ID`                                                                    |
| Signature header          | `X-AI-Service-Signature`                                                                 |
| Timestamp unit            | Unix seconds                                                                             |
| Body digest               | SHA-256 of the exact raw body, lowercase hexadecimal                                     |
| Canonical string          | `ai-service-v1\nPOST\n/v1/chat\n<timestamp>\n<request-id>\n<key-id>\n<sha256(raw-body)>` |
| Allowed clock skew        | 30 seconds                                                                               |
| Validity / replay window  | 120 seconds                                                                              |
| Nonce guard capacity      | 4,096 live request IDs; reject when full, never evict a live entry                       |
| Restart quarantine        | 150 seconds (`120s` validity + `30s` clock skew)                                         |
| Replay snapshot           | None in MVP; readiness stays false during the full quarantine                            |

The raw body carries the protocol, app, capability, request ID and trusted identity
fields that the canonical digest covers; the signature header is excluded from the
raw-body digest and canonical input. The key registry binds each key ID to issuer
`nextjs-bff`, the allowed app ID `qltbyt`, and capability `assistant-chat`. A
request is accepted only after issuer, audience, timestamp, body digest, key
binding, capability authorization and nonce uniqueness all pass.

Proof evidence: `go test -count=1 -run '^TestHMAC' ./...` and
`go test -race -count=1 -run '^TestHMAC' ./...` both pass in the isolated
module. The proof includes malformed-field rejection, wrong-signing-key and
raw-body binding, bounded concurrent admission, expiry reclaim without live
nonce eviction, key rotation and restart quarantine. No paid provider or live
service was used.
