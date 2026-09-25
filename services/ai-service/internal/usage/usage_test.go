package usage

import (
	"context"
	"errors"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

func TestKnownZeroStaysDistinctFromUnknown(t *testing.T) {
	zeroIn, zeroOut := 0, 0
	known := Classify(CallUsage{ProviderStarted: true, InputTokens: &zeroIn, OutputTokens: &zeroOut})
	if known.Knowledge != KnowledgeKnownZero || known.InputTokens == nil || *known.InputTokens != 0 {
		t.Fatalf("known zero = %+v", known)
	}
	unknown := Classify(CallUsage{ProviderStarted: true})
	if unknown.Knowledge != KnowledgeUnknown || unknown.InputTokens != nil || unknown.OutputTokens != nil {
		t.Fatalf("unknown = %+v", unknown)
	}
	output := 4
	partial := Classify(CallUsage{ProviderStarted: true, OutputTokens: &output})
	if partial.Knowledge != KnowledgePartial || partial.InputTokens != nil || partial.OutputTokens == nil || *partial.OutputTokens != 4 {
		t.Fatalf("partial = %+v", partial)
	}
	idle := Classify(CallUsage{})
	if idle.Knowledge != KnowledgeProviderNotStarted {
		t.Fatalf("idle = %+v", idle)
	}
}

func TestFinalizeBeforeExpiryIsIdempotent(t *testing.T) {
	clock := time.Unix(1_700_000_000, 0)
	book := NewMemory(func() time.Time { return clock })
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-1", TTL: protocol.ReservationTTL})
	if err != nil {
		t.Fatal(err)
	}
	if !reservation.ExpiresAt.Equal(clock.Add(protocol.ReservationTTL)) {
		t.Fatalf("expiry = %s", reservation.ExpiresAt)
	}
	input, output := 0, 2
	first, err := book.Finalize(context.Background(), reservation.ID, Classify(CallUsage{ProviderStarted: true, InputTokens: &input, OutputTokens: &output}))
	if err != nil {
		t.Fatal(err)
	}
	if !first.Measured || first.Uncertainty != UncertaintyMeasured || first.Refund || first.Status != StatusCompleted {
		t.Fatalf("first = %+v", first)
	}
	second, err := book.Finalize(context.Background(), reservation.ID, Observation{Knowledge: KnowledgeUnknown})
	if err != nil {
		t.Fatal(err)
	}
	if second != first {
		t.Fatalf("retry changed final record from %+v to %+v", first, second)
	}
}

func TestFinalizeAfterExpiryDoesNotBecomeMeasuredZero(t *testing.T) {
	clock := time.Unix(1_700_000_000, 0)
	book := NewMemory(func() time.Time { return clock })
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-expired"})
	if err != nil {
		t.Fatal(err)
	}
	input, output := 9, 0
	if err := book.Observe(context.Background(), reservation.ID, CallUsage{ProviderStarted: true, InputTokens: &input, OutputTokens: &output}); err != nil {
		t.Fatal(err)
	}
	clock = reservation.ExpiresAt
	record, err := book.Finalize(context.Background(), reservation.ID, Classify(CallUsage{ProviderStarted: true, InputTokens: &input, OutputTokens: &output}))
	if err != nil {
		t.Fatal(err)
	}
	if record.Measured || record.Refund || record.Uncertainty != UncertaintyExpired || record.Status != StatusExpiredUncertain {
		t.Fatalf("expired record = %+v", record)
	}
	if record.Knowledge == KnowledgeKnownZero {
		t.Fatal("expired known zero was presented as measured zero")
	}
	repeated, err := book.Finalize(context.Background(), reservation.ID, Observation{})
	if err != nil {
		t.Fatal(err)
	}
	if repeated != record {
		t.Fatalf("expired retry = %+v", repeated)
	}
}

func TestReserveRejectsDuplicateRequestID(t *testing.T) {
	book := NewMemory(func() time.Time { return time.Unix(1_700_000_000, 0) })
	if _, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-1"}); err != nil {
		t.Fatal(err)
	}
	_, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-1"})
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Status != 409 || serviceErr.Retryable {
		t.Fatalf("duplicate reserve = %v", err)
	}
}

func TestAggregateKeepsPartialWhenOneCallLacksUsage(t *testing.T) {
	input, output := 3, 4
	combined := Aggregate([]CallUsage{
		{ProviderStarted: true},
		{ProviderStarted: true, InputTokens: &input, OutputTokens: &output},
	})
	if combined.Knowledge != KnowledgePartial || combined.InputTokens == nil || *combined.InputTokens != 3 || *combined.OutputTokens != 4 {
		t.Fatalf("aggregate = %+v", combined)
	}
}
