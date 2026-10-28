package webpush

import (
	"context"
	"time"
)

type ClaimRequest struct {
	Version          int    `json:"version"`
	WorkerID         string `json:"worker_id"`
	Limit            int    `json:"limit"`
	VAPIDKeyVersion  string `json:"vapid_key_version"`
	VAPIDFingerprint string `json:"vapid_fingerprint"`
}

type ClaimResponse struct {
	Version          int        `json:"version"`
	ServerTime       string     `json:"server_time"`
	PollAfterSeconds int        `json:"poll_after_seconds"`
	Deliveries       []Delivery `json:"deliveries"`
}

type Delivery struct {
	DeliveryID           string           `json:"delivery_id"`
	AttemptToken         string           `json:"attempt_token"`
	Attempt              int              `json:"attempt"`
	SubscriptionID       string           `json:"subscription_id"`
	SubscriptionRevision string           `json:"subscription_revision"`
	LeaseExpiresAt       string           `json:"lease_expires_at"`
	Deadline             string           `json:"deadline"`
	TTLSeconds           int              `json:"ttl_seconds"`
	VAPIDKeyVersion      string           `json:"vapid_key_version"`
	Endpoint             string           `json:"endpoint"`
	Keys                 SubscriptionKeys `json:"keys"`
	PayloadBase64        string           `json:"payload_base64"`
}

type SubscriptionKeys struct {
	P256DH string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type ReportRequest struct {
	Version int          `json:"version"`
	Results []ReportItem `json:"results"`
}

type ReportItem struct {
	DeliveryID           string `json:"delivery_id"`
	AttemptToken         string `json:"attempt_token"`
	SubscriptionRevision string `json:"subscription_revision"`
	Outcome              string `json:"outcome"`
	ProviderStatus       *int   `json:"provider_status"`
	RetryAfterSeconds    *int   `json:"retry_after_seconds"`
}

type ReportResponse struct {
	Version int            `json:"version"`
	Results []ReportResult `json:"results"`
}

type ReportResult struct {
	DeliveryID string `json:"delivery_id"`
	Result     string `json:"result"`
}

type ProviderResult struct {
	Status            int
	RetryAfterSeconds *int
	Outcome           string
}

// BackendError carries backend retry policy without transport-specific details.
type BackendError struct {
	Retryable  bool
	Disabled   bool
	RetryAfter *time.Duration
	Err        error
}

func (e *BackendError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "web push backend error"
}

func (e *BackendError) Unwrap() error { return e.Err }

// Backend claims deliveries and reports attempts. Implementations use BackendError
// for explicit retry policy; unknown errors remain retryable.
type Backend interface {
	Claim(context.Context, ClaimRequest) (ClaimResponse, error)
	Report(context.Context, ReportRequest) (ReportResponse, error)
}

type Sender interface {
	Send(context.Context, Delivery, VAPIDKey, time.Duration) (ProviderResult, error)
}
