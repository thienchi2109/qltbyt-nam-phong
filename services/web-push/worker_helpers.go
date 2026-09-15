package webpush

import (
	"context"
	"errors"
	"regexp"
	"time"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var workerIDPattern = regexp.MustCompile(`^[a-z0-9-]{1,64}$`)

func validClaimResponse(response ClaimResponse) bool {
	if response.Version != 1 || response.PollAfterSeconds != 5 || len(response.Deliveries) > claimLimit {
		return false
	}
	if _, err := parseTime(response.ServerTime); err != nil {
		return false
	}
	for _, delivery := range response.Deliveries {
		if !uuidPattern.MatchString(delivery.DeliveryID) ||
			!uuidPattern.MatchString(delivery.AttemptToken) ||
			delivery.Attempt < 1 || delivery.Attempt > 100 ||
			!uuidPattern.MatchString(delivery.SubscriptionID) ||
			delivery.SubscriptionRevision == "" ||
			delivery.VAPIDKeyVersion == "" || delivery.Endpoint == "" ||
			delivery.PayloadBase64 == "" {
			return false
		}
		if _, err := parseTime(delivery.LeaseExpiresAt); err != nil {
			return false
		}
		if _, err := parseTime(delivery.Deadline); err != nil {
			return false
		}
		if delivery.TTLSeconds < 0 {
			return false
		}
	}
	return true
}

func validReportResponse(response ReportResponse, request ReportRequest) bool {
	if response.Version != 1 || len(response.Results) != len(request.Results) {
		return false
	}
	expected := make(map[string]struct{}, len(request.Results))
	for _, item := range request.Results {
		expected[item.DeliveryID] = struct{}{}
	}
	seen := make(map[string]struct{}, len(response.Results))
	for _, result := range response.Results {
		if !uuidPattern.MatchString(result.DeliveryID) ||
			(result.Result != "applied" && result.Result != "duplicate" && result.Result != "stale") {
			return false
		}
		if _, ok := seen[result.DeliveryID]; ok {
			return false
		}
		if _, ok := expected[result.DeliveryID]; !ok {
			return false
		}
		seen[result.DeliveryID] = struct{}{}
	}
	return true
}

func reportItem(delivery Delivery, outcome string, status, retryAfter *int) ReportItem {
	return ReportItem{
		DeliveryID:           delivery.DeliveryID,
		AttemptToken:         delivery.AttemptToken,
		SubscriptionRevision: delivery.SubscriptionRevision,
		Outcome:              outcome,
		ProviderStatus:       status,
		RetryAfterSeconds:    retryAfter,
	}
}

func outcomeForStatus(status int) string {
	switch {
	case status >= 200 && status <= 299:
		return "accepted"
	case status == 404 || status == 410:
		return "endpoint_gone"
	case status == 401 || status == 403:
		return "credential_error"
	case status == 408 || status == 429 || status >= 500:
		return "transient"
	default:
		return "permanent"
	}
}

func parseTime(value string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, err
	}
	return parsed.UTC(), nil
}

func pollDelay(response ClaimResponse) time.Duration {
	if response.PollAfterSeconds <= 0 {
		return 5 * time.Second
	}
	return time.Duration(response.PollAfterSeconds) * time.Second
}

func sleepContext(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func lastErrOrLeaseError(err error) error {
	if err != nil {
		return err
	}
	return errors.New("report lease expired")
}

func isRetryableWorkerError(err error) bool {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.Status == 0 || apiErr.Status == 429 || apiErr.Status == 503 || apiErr.Status >= 500
	}
	return !errors.Is(err, ErrInvalidResponse)
}

func isDisabledError(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.Code == "disabled"
}
