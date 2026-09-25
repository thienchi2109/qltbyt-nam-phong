package ingress

// Shared with src/lib/ai/go-bff. This is a test vector, not a production key.
const (
	VectorTimestamp = "1700000000"
	VectorRequestID = "req-vector-1"
	VectorKeyID     = "key-vector"
	VectorSecret    = "test-vector-secret"
	VectorBody      = `{"protocol_version":"v1","app_id":"second-app","capability_id":"inventory-note","capability_version":"v1","request_id":"req-vector-1","identity":{"issuer":"nextjs-bff","audience":"ai-service-v1"},"messages":[{"role":"user","content":"hello"}]}`
	VectorSignature = "v6UXlOeavIFZukFqrLqjSFt0SNRPpjBEZNF_zG3QUuk"
)
