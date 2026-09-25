// Package ingress is the app-neutral HTTP boundary for the shared AI service.
package ingress

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
)

const (
	ProtocolLabel = "ai-service-v1"
	Method        = "POST"
	Path          = "/v1/chat"

	HeaderTimestamp = "X-AI-Service-Timestamp"
	HeaderRequestID = "X-AI-Service-Request-ID"
	HeaderKeyID     = "X-AI-Service-Key-ID"
	HeaderSignature = "X-AI-Service-Signature"
	HeaderRequest   = "X-Request-ID"
)

// CanonicalString is the reviewed ai-service-v1 signing input.
// The signature header is not part of the string or the body digest.
func CanonicalString(timestamp, requestID, keyID string, rawBody []byte) string {
	digest := sha256.Sum256(rawBody)
	return strings.Join([]string{
		ProtocolLabel,
		Method,
		Path,
		timestamp,
		requestID,
		keyID,
		hex.EncodeToString(digest[:]),
	}, "\n")
}

// Sign returns the raw URL-safe HMAC-SHA256 of the canonical string.
func Sign(secret []byte, timestamp, requestID, keyID string, rawBody []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(CanonicalString(timestamp, requestID, keyID, rawBody)))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func signaturesMatch(secret []byte, timestamp, requestID, keyID, signature string, rawBody []byte) bool {
	if len(secret) == 0 || signature == "" {
		return false
	}
	expected := Sign(secret, timestamp, requestID, keyID, rawBody)
	return hmac.Equal([]byte(expected), []byte(signature))
}
