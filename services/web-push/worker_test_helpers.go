package webpush

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

type fakeAPI struct {
	mu          sync.Mutex
	claimCalls  int
	reportCalls int
	claim       ClaimResponse
	reports     []ReportRequest
	claimErr    error
	reportErrs  []error
}

func (f *fakeAPI) Claim(context.Context, ClaimRequest) (ClaimResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.claimCalls++
	return f.claim, f.claimErr
}

func (f *fakeAPI) Report(_ context.Context, request ReportRequest) (ReportResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.reportCalls++
	f.reports = append(f.reports, request)
	if len(f.reportErrs) > 0 {
		err := f.reportErrs[0]
		f.reportErrs = f.reportErrs[1:]
		return ReportResponse{}, err
	}
	results := make([]ReportResult, len(request.Results))
	for index, item := range request.Results {
		results[index] = ReportResult{DeliveryID: item.DeliveryID, Result: "applied"}
	}
	return ReportResponse{Version: 1, Results: results}, nil
}

type fakeSender struct {
	mu       sync.Mutex
	sends    []Delivery
	timeouts []time.Duration
	result   ProviderResult
	started  chan struct{}
	block    <-chan struct{}
}

func (f *fakeSender) Send(ctx context.Context, delivery Delivery, _ VAPIDKey, timeout time.Duration) (ProviderResult, error) {
	f.mu.Lock()
	f.sends = append(f.sends, delivery)
	f.timeouts = append(f.timeouts, timeout)
	if f.started != nil {
		select {
		case f.started <- struct{}{}:
		default:
		}
	}
	f.mu.Unlock()
	if f.block != nil {
		select {
		case <-f.block:
		case <-ctx.Done():
			return ProviderResult{}, ctx.Err()
		}
	}
	return f.result, nil
}

func writeVAPIDSecret(t *testing.T, raw []byte) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "vapid.key")
	if err := os.WriteFile(path, []byte(base64.RawURLEncoding.EncodeToString(raw)), 0o400); err != nil {
		t.Fatal(err)
	}
	return path
}

func testVAPIDKey(t *testing.T) VAPIDKey {
	t.Helper()
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	key, err := LoadVAPIDKey(writeVAPIDSecret(t, privateKey), "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func testDelivery() Delivery {
	now := time.Now().UTC()
	return Delivery{
		DeliveryID:           "00000000-0000-0000-0000-000000000001",
		AttemptToken:         "00000000-0000-0000-0000-000000000002",
		Attempt:              1,
		SubscriptionID:       "00000000-0000-0000-0000-000000000003",
		SubscriptionRevision: "1",
		LeaseExpiresAt:       now.Add(45 * time.Second).Format(time.RFC3339),
		Deadline:             now.Add(time.Hour).Format(time.RFC3339),
		TTLSeconds:           60,
		VAPIDKeyVersion:      "staging-20260910-01",
		Endpoint:             "https://push.example.test/send",
		Keys:                 SubscriptionKeys{P256DH: "public", Auth: "auth"},
		PayloadBase64:        base64.StdEncoding.EncodeToString([]byte(`{"version":1}`)),
	}
}
