package qltbyt

import (
	"context"
	"errors"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

func TestCleanupAllowsFinalizeOnlyWithReservation(t *testing.T) {
	cred := testCredential("admin", nil, facilityPtr(7))
	parent, cancel := context.WithCancel(context.Background())
	cancel()
	broker := &spyBroker{}
	assistant := testAssistant(broker, &spyQuery{})
	if _, err := assistant.gate().Cleanup(parent, cred, RPCQuotaReserve, []byte(`{"p_reservation_id":"res-1"}`)); err == nil || len(broker.snapshot()) != 0 {
		t.Fatal("cleanup called quota reserve")
	}
	if _, err := assistant.gate().Cleanup(parent, cred, RPCQuotaFinalize, nil); err == nil || len(broker.snapshot()) != 0 {
		t.Fatal("cleanup called quota finalize")
	}
	for _, payload := range [][]byte{nil, {}, []byte(`{}`), []byte(`{"p_reservation_id":""}`), []byte(`{"p_reservation_id":"  "}`)} {
		if _, err := assistant.gate().Cleanup(parent, cred, RPCQuotaFinalize, payload); err == nil || len(broker.snapshot()) != 0 {
			t.Fatalf("accepted finalize payload %s", payload)
		}
	}
	widened := []byte(`{"p_reservation_id":"res-1","p_user_id":999}`)
	if _, err := assistant.gate().Cleanup(parent, cred, RPCQuotaFinalize, widened); err == nil || len(broker.snapshot()) != 0 {
		t.Fatal("cleanup widened the user")
	}
	if _, err := assistant.gate().Cleanup(parent, cred, RPCQuotaFinalize, []byte(`{"p_reservation_id":"res-1","p_status":"success","p_tokens_in":0,"p_tokens_out":0}`)); err != nil || len(broker.snapshot()) != 1 {
		t.Fatalf("valid finalize err=%v calls=%d", err, len(broker.snapshot()))
	}
}

func TestCleanupDeadlineCutsHungFinalize(t *testing.T) {
	cred := testCredential("admin", nil, facilityPtr(7))
	waiter := &spyBroker{wait: true, start: make(chan struct{})}
	assistant := testAssistant(waiter, nil)
	assistant.Cleanup = 30 * time.Millisecond
	started := time.Now()
	errCh := make(chan error, 1)
	go func() {
		_, err := assistant.gate().Cleanup(context.Background(), cred, RPCQuotaFinalize, []byte(`{"p_reservation_id":"res-hang"}`))
		errCh <- err
	}()
	select {
	case <-waiter.start:
	case <-time.After(time.Second):
		t.Fatal("finalize did not start")
	}
	select {
	case err := <-errCh:
		if !errors.Is(err, context.DeadlineExceeded) || time.Since(started) > time.Second {
			t.Fatalf("err=%v elapsed=%s", err, time.Since(started))
		}
	case <-time.After(time.Second):
		t.Fatal("hung finalize was not cut")
	}
	fast := testAssistant(&spyBroker{}, nil)
	started = time.Now()
	if _, err := fast.gate().Cleanup(context.Background(), cred, RPCQuotaFinalize, []byte(`{"p_reservation_id":"res-fast"}`)); err != nil {
		t.Fatal(err)
	}
	if time.Since(started) >= protocol.CleanupBudget {
		t.Fatal("fast finalize did not fit in 5 seconds")
	}
	gate := gate{cleanup: 10 * time.Second}
	if gate.cleanupBudget() != protocol.CleanupBudget {
		t.Fatalf("cleanup budget = %s", gate.cleanupBudget())
	}
}
