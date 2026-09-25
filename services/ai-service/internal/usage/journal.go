package usage

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const journalFileMode os.FileMode = 0o600

var errTornJournal = errors.New("torn usage journal")

type contextGate struct {
	token chan struct{}
}

func newContextGate() contextGate { return contextGate{token: make(chan struct{}, 1)} }

func (g *contextGate) Lock() { g.token <- struct{}{} }

func (g *contextGate) LockContext(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	select {
	case g.token <- struct{}{}:
		if err := ctx.Err(); err != nil {
			g.Unlock()
			return err
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (g *contextGate) Unlock() { <-g.token }

var journalGates sync.Map

func journalGate(path string) *contextGate {
	key, err := filepath.Abs(path)
	if err == nil {
		path = key
	}
	created := newContextGate()
	gate, _ := journalGates.LoadOrStore(path, &created)
	return gate.(*contextGate)
}

func waitJournal(ctx context.Context, path string) error {
	gate := journalGate(path)
	if err := gate.LockContext(ctx); err != nil {
		return err
	}
	gate.Unlock()
	return nil
}

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

// journalSync is the durability wait. Tests replace it to prove cleanup does not
// wait out a stuck Sync.
var journalSync = func(file *os.File) error { return file.Sync() }

var journalOpenFile = os.OpenFile

func appendJournal(ctx context.Context, path string, line journalLine) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	payload, err := json.Marshal(line)
	if err != nil {
		return err
	}
	gate := journalGate(path)
	if err := gate.LockContext(ctx); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() {
		defer gate.Unlock()
		file, openErr := journalOpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, journalFileMode)
		if openErr != nil {
			done <- openErr
			return
		}
		n, writeErr := file.Write(append(payload, '\n'))
		if writeErr == nil && n != len(payload)+1 {
			writeErr = io.ErrShortWrite
		}
		var syncErr error
		if writeErr == nil {
			syncErr = journalSync(file)
		}
		done <- errors.Join(writeErr, syncErr, file.Close())
	}()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
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
