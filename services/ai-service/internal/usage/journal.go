package usage

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"time"
)

const journalFileMode os.FileMode = 0o600

var errTornJournal = errors.New("torn usage journal")

type journalLine struct {
	Kind          string `json:"kind"`
	ReservationID string `json:"reservation_id"`
	RequestID     string `json:"request_id,omitempty"`
	AttemptID     string `json:"attempt_id,omitempty"`
	ExpiresAt     string `json:"expires_at,omitempty"`
	InputTokens   *int64 `json:"input_tokens"`
	OutputTokens  *int64 `json:"output_tokens"`
	Uncertainty   string `json:"uncertainty,omitempty"`
	Knowledge     string `json:"knowledge,omitempty"`
	Status        string `json:"status,omitempty"`
	RPCStatus     string `json:"rpc_status,omitempty"`
	Attempts      int    `json:"attempts,omitempty"`
	Measured      bool   `json:"measured,omitempty"`
	Refund        bool   `json:"refund,omitempty"`
}

func readJournal(path string) ([]journalLine, error) {
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	var lines []journalLine
	for scanner.Scan() {
		raw := bytes.TrimSpace(scanner.Bytes())
		if len(raw) == 0 {
			continue
		}
		var line journalLine
		if err := json.Unmarshal(raw, &line); err != nil {
			return nil, errors.Join(errTornJournal, err)
		}
		lines = append(lines, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return lines, nil
}

func appendJournal(path string, line journalLine) error {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, journalFileMode)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(line)
	if err == nil {
		_, err = file.Write(append(payload, '\n'))
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

func formatExpiry(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func parseExpiry(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}
