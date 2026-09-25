package phase0proof

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"testing"
)

type journalRecord struct {
	Kind          string `json:"kind"`
	ReservationID string `json:"reservation_id"`
	AttemptID     string `json:"attempt_id,omitempty"`
	InputTokens   int    `json:"input_tokens"`
	OutputTokens  int    `json:"output_tokens"`
	Uncertainty   string `json:"uncertainty,omitempty"`
}

type usageJournal struct {
	path     string
	appendFn func(journalRecord) error
}

func (j usageJournal) append(record journalRecord) error {
	if j.appendFn != nil {
		return j.appendFn(record)
	}
	file, err := os.OpenFile(j.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	data, err := json.Marshal(record)
	if err == nil {
		_, err = fmt.Fprintln(file, string(data))
	}
	if err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	return closeErr
}

func (j usageJournal) records() ([]journalRecord, error) {
	file, err := os.Open(j.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var records []journalRecord
	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		var record journalRecord
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
			return nil, fmt.Errorf("%w at line %d: %v", errTornJournal, lineNumber, err)
		}
		records = append(records, record)
	}
	return records, scanner.Err()
}

func beginProviderAttempt(journal usageJournal, reservationID, attemptID string) error {
	return journal.append(journalRecord{
		Kind:          "provider_intent",
		ReservationID: reservationID,
		AttemptID:     attemptID,
	})
}

func observeProviderUsage(
	journal usageJournal,
	reservationID, attemptID string,
	kind usageKnowledge,
	inputTokens, outputTokens int,
) error {
	uncertainty := string(unknown)
	switch kind {
	case knownZero, knownPositive:
		uncertainty = "measured"
	case partial:
		uncertainty = string(partial)
	}
	return journal.append(journalRecord{
		Kind:          "usage_observed",
		ReservationID: reservationID,
		AttemptID:     attemptID,
		InputTokens:   maxZero(inputTokens),
		OutputTokens:  maxZero(outputTokens),
		Uncertainty:   uncertainty,
	})
}

func executeProviderAttempt(
	journal usageJournal,
	reservationID, attemptID string,
	provider func() (usageKnowledge, int, int, error),
) error {
	// Provider work is forbidden until the write-ahead intent is durable.
	if err := beginProviderAttempt(journal, reservationID, attemptID); err != nil {
		return fmt.Errorf("provider intent was not durable: %w", err)
	}
	kind, inputTokens, outputTokens, providerErr := provider()
	if err := observeProviderUsage(journal, reservationID, attemptID, kind, inputTokens, outputTokens); err != nil {
		return fmt.Errorf("provider usage was not durable: %w", err)
	}
	return providerErr
}

type pendingAttempt struct {
	intents map[string]journalRecord
	usages  map[string]journalRecord
}

func pendingJournalRecords(records []journalRecord) map[string]pendingAttempt {
	pending := make(map[string]pendingAttempt)
	for _, record := range records {
		switch record.Kind {
		case "provider_intent":
			attempt := pending[record.ReservationID]
			if attempt.intents == nil {
				attempt.intents = make(map[string]journalRecord)
			}
			attempt.intents[record.AttemptID] = record
			pending[record.ReservationID] = attempt
		case "usage_observed":
			attempt := pending[record.ReservationID]
			if attempt.usages == nil {
				attempt.usages = make(map[string]journalRecord)
			}
			attempt.usages[record.AttemptID] = record
			pending[record.ReservationID] = attempt
		case "finalized", "uncertain":
			delete(pending, record.ReservationID)
		}
	}
	return pending
}

func recoveredUsage(reservationID string, pending pendingAttempt) journalRecord {
	recovered := journalRecord{Kind: "usage_observed", ReservationID: reservationID, Uncertainty: "measured"}
	unknownUsage := false
	partialUsage := false
	for attemptID := range pending.intents {
		usage, ok := pending.usages[attemptID]
		if !ok {
			unknownUsage = true
			continue
		}
		recovered.InputTokens += usage.InputTokens
		recovered.OutputTokens += usage.OutputTokens
		switch usage.Uncertainty {
		case string(unknown):
			unknownUsage = true
		case string(partial):
			partialUsage = true
		}
	}
	if unknownUsage {
		recovered.Uncertainty = string(unknown)
	} else if partialUsage {
		recovered.Uncertainty = string(partial)
	}
	return recovered
}

var (
	errReservationExpired = errors.New("reservation expired")
	errTornJournal        = errors.New("torn usage journal")
)

type quotaFinalizer struct {
	expired   bool
	calls     int
	applied   int
	finalized map[string]journalRecord
}

func (f *quotaFinalizer) finalize(record journalRecord) error {
	f.calls++
	if f.expired {
		return errReservationExpired
	}
	if _, ok := f.finalized[record.ReservationID]; ok {
		return nil
	}
	f.finalized[record.ReservationID] = record
	f.applied++
	return nil
}

func replayJournal(journal usageJournal, finalizer *quotaFinalizer) error {
	records, err := journal.records()
	if err != nil {
		return err
	}
	for reservationID, pending := range pendingJournalRecords(records) {
		// Provider work was allowed, but a missing observation remains unknown.
		recovered := recoveredUsage(reservationID, pending)
		if err := finalizer.finalize(recovered); err != nil {
			if errors.Is(err, errReservationExpired) {
				if appendErr := journal.append(journalRecord{
					Kind:          "uncertain",
					ReservationID: reservationID,
					Uncertainty:   "reservation_expired_before_recovery",
				}); appendErr != nil {
					return appendErr
				}
				continue
			}
			return err
		}
		if err := journal.append(journalRecord{
			Kind:          "finalized",
			ReservationID: reservationID,
		}); err != nil {
			return err
		}
	}
	return nil
}

func mustRecords(t *testing.T, journal usageJournal) []journalRecord {
	t.Helper()
	records, err := journal.records()
	if err != nil {
		t.Fatal(err)
	}
	return records
}
