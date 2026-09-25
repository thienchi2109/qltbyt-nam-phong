package phase0proof

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"testing"
	"time"
)

func TestBFFRPCBrokerRejectsInvalidLifetimeBoundaries(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	baseClaims := brokerClaims{
		Issuer:     credentialIssuer,
		Audience:   credentialAudience,
		IssuedAt:   now,
		ExpiresAt:  now.Add(credentialTTL),
		RPCName:    "ai_quota_reserve",
		UserID:     42,
		FacilityID: 7,
	}
	cases := []struct {
		name   string
		mutate func(*brokerClaims)
	}{
		{name: "issued in the future", mutate: func(claims *brokerClaims) {
			claims.IssuedAt = now.Add(time.Second)
			claims.ExpiresAt = now.Add(credentialTTL)
		}},
		{name: "expires at current time", mutate: func(claims *brokerClaims) {
			claims.ExpiresAt = now
		}},
		{name: "expires before issue", mutate: func(claims *brokerClaims) {
			claims.IssuedAt = now.Add(2 * time.Second)
			claims.ExpiresAt = now.Add(time.Second)
		}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			claims := baseClaims
			test.mutate(&claims)
			envelope := signBrokerClaims(claims, privateKey)
			if err := validateBrokerEnvelope(now, envelope, publicKey); err == nil {
				t.Fatal("invalid credential lifetime was accepted")
			}
		})
	}
}

func TestBFFRPCBrokerBoundsCancellationAndQuotaCleanup(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	envelope, publicKey := testBrokerEnvelope(t, now, "ai_quota_finalize")
	if err := authorizeQuotaCleanup(now, envelope, publicKey, "reservation-1", cleanupBudget); err != nil {
		t.Fatal(err)
	}
	if err := authorizeQuotaCleanup(now, envelope, publicKey, "reservation-2", time.Second); err == nil {
		t.Fatal("cleanup crossed reservation boundary")
	}
	if err := authorizeQuotaCleanup(now, envelope, publicKey, "reservation-1", cleanupBudget+time.Nanosecond); err == nil {
		t.Fatal("cleanup exceeded bounded budget")
	}

	call, err := authorizeBrokerCall(now, envelope, publicKey)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	called := false
	if err := dispatchBrokerRPC(ctx, call, func(context.Context, brokerRPC) error {
		called = true
		return nil
	}); !errors.Is(err, context.Canceled) || called {
		t.Fatalf("cancelled broker dispatch = err %v, called %v", err, called)
	}
}

func TestBFFRPCBrokerCancelsInFlightQuotaCleanupWithinBudget(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	envelope, publicKey := testBrokerEnvelope(t, now, "ai_quota_finalize")
	budget := 10 * time.Millisecond
	started := make(chan struct{})
	result := make(chan error, 1)
	go func() {
		result <- dispatchQuotaCleanup(context.Background(), now, envelope, publicKey, "reservation-1", budget, func(ctx context.Context, _ brokerRPC) error {
			close(started)
			<-ctx.Done()
			return ctx.Err()
		})
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("cleanup RPC did not start")
	}
	select {
	case err := <-result:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("in-flight cleanup error = %v, want deadline", err)
		}
	case <-time.After(time.Second):
		t.Fatal("in-flight cleanup exceeded its bounded budget")
	}
}

func TestBFFRPCBrokerRequiresFailureAuditClass(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	envelope, publicKey := testBrokerEnvelope(t, now, "assistant_query_database_audit_log")
	call, err := authorizeBrokerCall(now, envelope, publicKey)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := auditCall(call, "SELECT 1", "success", "", "selected"); err == nil {
		t.Fatal("missing audit tool path was accepted")
	}
	call.ToolPath = "query_database"
	if _, err := auditCall(call, "SELECT 1", "failure", "", "session"); err == nil {
		t.Fatal("failure audit without error class was accepted")
	}
	if _, err := auditCall(call, string(make([]byte, 1001)), "success", "", "selected"); err == nil {
		t.Fatal("oversized SQL shape was accepted")
	}
	if _, err := auditCall(call, "SELECT 1", "success", "", "browser"); err == nil {
		t.Fatal("browser facility source was accepted")
	}
}
