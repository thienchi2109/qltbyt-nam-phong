package phase0proof

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestWriteAheadIntentPrecedesProviderWork(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	providerCalled := false
	if err := executeProviderAttempt(j, "reservation-1", "attempt-1", func() (usageKnowledge, int, int, error) {
		beforeProvider, err := j.records()
		if err != nil {
			t.Fatal(err)
		}
		if len(beforeProvider) != 1 || beforeProvider[0].Kind != "provider_intent" {
			t.Fatalf("records visible before provider = %+v", beforeProvider)
		}
		providerCalled = true
		return knownPositive, 12, 8, nil
	}); err != nil {
		t.Fatal(err)
	}
	if !providerCalled {
		t.Fatal("provider did not run after durable intent")
	}
	records := mustRecords(t, j)
	if len(records) != 2 || records[0].Kind != "provider_intent" || records[1].Kind != "usage_observed" {
		t.Fatalf("write-ahead records = %+v", records)
	}
}

func TestWriteAheadFailurePreventsProviderWork(t *testing.T) {
	j := usageJournal{appendFn: func(journalRecord) error {
		return errors.New("disk unavailable")
	}}
	providerCalled := false
	err := executeProviderAttempt(j, "reservation-1", "attempt-1", func() (usageKnowledge, int, int, error) {
		providerCalled = true
		return knownPositive, 12, 8, nil
	})
	if err == nil || providerCalled {
		t.Fatalf("write-ahead failure = %v, providerCalled=%v", err, providerCalled)
	}
}

func TestCrashRecoveryReplaysObservedUsageBeforeExpiry(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	if err := executeProviderAttempt(j, "reservation-1", "attempt-1", func() (usageKnowledge, int, int, error) {
		return knownPositive, 12, 8, nil
	}); err != nil {
		t.Fatal(err)
	}

	finalizer := &quotaFinalizer{finalized: make(map[string]journalRecord)}
	if err := replayJournal(j, finalizer); err != nil {
		t.Fatal(err)
	}
	recovered := finalizer.finalized["reservation-1"]
	if recovered.InputTokens != 12 || recovered.OutputTokens != 8 || recovered.Uncertainty != "measured" {
		t.Fatalf("recovered usage = %+v", recovered)
	}
	if pending := pendingJournalRecords(mustRecords(t, j)); len(pending) != 0 {
		t.Fatalf("pending journal records after replay = %d", len(pending))
	}
	if err := replayJournal(j, finalizer); err != nil {
		t.Fatal(err)
	}
	if finalizer.calls != 1 {
		t.Fatalf("finalize calls after idempotent replay = %d, want 1", finalizer.calls)
	}
}

func TestCrashRecoveryAggregatesObservedRetryUsage(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	if err := executeProviderAttempt(j, "reservation-retry", "attempt-1", func() (usageKnowledge, int, int, error) {
		return knownPositive, 12, 8, nil
	}); err != nil {
		t.Fatal(err)
	}
	retryErr := errors.New("transient retry")
	if err := executeProviderAttempt(j, "reservation-retry", "attempt-2", func() (usageKnowledge, int, int, error) {
		return knownPositive, 4, 3, retryErr
	}); !errors.Is(err, retryErr) {
		t.Fatalf("retry provider error = %v", err)
	}

	finalizer := &quotaFinalizer{finalized: make(map[string]journalRecord)}
	if err := replayJournal(j, finalizer); err != nil {
		t.Fatal(err)
	}
	recovered := finalizer.finalized["reservation-retry"]
	if recovered.InputTokens != 16 || recovered.OutputTokens != 11 || recovered.Uncertainty != "measured" {
		t.Fatalf("aggregated retry usage = %+v", recovered)
	}
}

func TestProviderErrorWithoutUsageIsUnknown(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	providerErr := errors.New("provider failed before reporting usage")
	if err := executeProviderAttempt(j, "reservation-missing-usage", "attempt-1", func() (usageKnowledge, int, int, error) {
		return usageKnowledge(""), 0, 0, providerErr
	}); !errors.Is(err, providerErr) {
		t.Fatalf("provider error = %v", err)
	}
	records := mustRecords(t, j)
	if len(records) != 2 || records[1].Kind != "usage_observed" || records[1].Uncertainty != string(unknown) {
		t.Fatalf("missing usage record = %+v", records)
	}
}

func TestProviderErrorWithExplicitKnownZeroRemainsMeasured(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	providerErr := errors.New("provider failed after known zero usage")
	if err := executeProviderAttempt(j, "reservation-known-zero", "attempt-1", func() (usageKnowledge, int, int, error) {
		return knownZero, 0, 0, providerErr
	}); !errors.Is(err, providerErr) {
		t.Fatalf("provider error = %v", err)
	}
	records := mustRecords(t, j)
	if len(records) != 2 || records[1].Uncertainty != "measured" || records[1].InputTokens != 0 || records[1].OutputTokens != 0 {
		t.Fatalf("known zero usage record = %+v", records)
	}
}

func TestCrashAfterProviderBeforeUsageObservationIsConservative(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	if err := beginProviderAttempt(j, "reservation-unknown", "attempt-unknown"); err != nil {
		t.Fatal(err)
	}

	finalizer := &quotaFinalizer{finalized: make(map[string]journalRecord)}
	if err := replayJournal(j, finalizer); err != nil {
		t.Fatal(err)
	}
	recovered := finalizer.finalized["reservation-unknown"]
	if recovered.Uncertainty != string(unknown) || recovered.InputTokens != 0 || recovered.OutputTokens != 0 {
		t.Fatalf("unknown recovery = %+v", recovered)
	}
}

func TestCrashRecoveryMarksExpiredReservationUncertain(t *testing.T) {
	j := usageJournal{path: filepath.Join(t.TempDir(), "usage.journal")}
	if err := executeProviderAttempt(j, "reservation-expired", "attempt-expired", func() (usageKnowledge, int, int, error) {
		return knownPositive, 12, 8, nil
	}); err != nil {
		t.Fatal(err)
	}

	finalizer := &quotaFinalizer{expired: true, finalized: make(map[string]journalRecord)}
	if err := replayJournal(j, finalizer); err != nil {
		t.Fatal(err)
	}
	if len(finalizer.finalized) != 0 {
		t.Fatal("expired reservation was reported as recovered")
	}
	records := mustRecords(t, j)
	if len(records) != 3 || records[2].Kind != "uncertain" || records[2].Uncertainty != "reservation_expired_before_recovery" {
		t.Fatalf("expired recovery record = %+v", records)
	}
}

func TestCrashAfterFinalizeBeforeMarkerIsIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "usage.journal")
	base := usageJournal{path: path}
	markerFailed := false
	j := usageJournal{
		path: path,
		appendFn: func(record journalRecord) error {
			if record.Kind == "finalized" && !markerFailed {
				markerFailed = true
				return errors.New("crash before finalized marker")
			}
			return base.append(record)
		},
	}
	if err := executeProviderAttempt(j, "reservation-marker", "attempt-1", func() (usageKnowledge, int, int, error) {
		return knownPositive, 12, 8, nil
	}); err != nil {
		t.Fatal(err)
	}
	finalizer := &quotaFinalizer{finalized: make(map[string]journalRecord)}
	if err := replayJournal(j, finalizer); err == nil {
		t.Fatal("missing finalized marker failure was swallowed")
	}
	if finalizer.applied != 1 || len(finalizer.finalized) != 1 {
		t.Fatalf("finalizer after marker failure = %+v", finalizer)
	}
	if err := replayJournal(j, finalizer); err != nil {
		t.Fatal(err)
	}
	if finalizer.applied != 1 || finalizer.calls != 2 {
		t.Fatalf("finalizer was not idempotent after marker retry = %+v", finalizer)
	}
	if pending := pendingJournalRecords(mustRecords(t, j)); len(pending) != 0 {
		t.Fatalf("pending records after marker retry = %d", len(pending))
	}
}

func TestTornJournalFailsClosedWithoutFinalization(t *testing.T) {
	path := filepath.Join(t.TempDir(), "usage.journal")
	if err := os.WriteFile(path, []byte("{\"kind\":\"provider_intent\",\"reservation_id\":\"torn\",\"attempt_id\":\"attempt-1\"}\n{\"kind\":\"usage_observed\""), 0o600); err != nil {
		t.Fatal(err)
	}
	finalizer := &quotaFinalizer{finalized: make(map[string]journalRecord)}
	err := replayJournal(usageJournal{path: path}, finalizer)
	if !errors.Is(err, errTornJournal) {
		t.Fatalf("torn journal error = %v", err)
	}
	if finalizer.calls != 0 || len(finalizer.finalized) != 0 {
		t.Fatalf("torn journal finalized records = %+v", finalizer)
	}
}
