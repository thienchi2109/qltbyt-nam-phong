package webpush

import (
	"context"
	"time"
)

type ClaimRequest struct {
	WorkerID         string
	Limit            int
	VAPIDKeyVersion  string
	VAPIDFingerprint string
}

type ClaimResponse struct {
	ServerTime       string
	PollAfterSeconds int
	Deliveries       []Delivery
}

type Delivery struct {
	DeliveryID           string
	AttemptToken         string
	Attempt              int
	SubscriptionID       string
	SubscriptionRevision string
	LeaseExpiresAt       string
	Deadline             string
	TTLSeconds           int
	VAPIDKeyVersion      string
	Endpoint             string
	Keys                 SubscriptionKeys
	PayloadBase64        string
}

type SubscriptionKeys struct {
	P256DH string
	Auth   string
}

type ReportRequest struct {
	Results []ReportItem
}

type ReportItem struct {
	DeliveryID           string
	AttemptToken         string
	SubscriptionRevision string
	Outcome              string
	ProviderStatus       *int
	RetryAfterSeconds    *int
}

type ReportResponse struct {
	Results []ReportResult
}

type ReportResult struct {
	DeliveryID string
	Result     string
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
