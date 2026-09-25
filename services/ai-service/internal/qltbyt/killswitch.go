package qltbyt

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	killSwitchFreshTTL = 8 * time.Second
	killSwitchErrorTTL = 2 * time.Second
)

type killSwitchState struct {
	mu      sync.Mutex
	valid   bool
	blocked bool
	source  string
	expires time.Time
}

func (a Assistant) killSwitch(ctx context.Context, cred Credential) (bool, string, error) {
	if err := ctx.Err(); err != nil {
		return false, "", err
	}
	if strings.EqualFold(os.Getenv("AI_KILL_SWITCH"), "on") {
		return true, "env", nil
	}
	now := a.clock()
	if a.kill != nil {
		a.kill.mu.Lock()
		if a.kill.valid && now.Before(a.kill.expires) {
			blocked, source := a.kill.blocked, a.kill.source
			a.kill.mu.Unlock()
			return blocked, source, nil
		}
		a.kill.mu.Unlock()
	}
	raw, err := a.gate().Call(ctx, cred, RPCKillSwitch, []byte(`{}`))
	if err != nil {
		if ctx.Err() != nil {
			return false, "", ctx.Err()
		}
		a.storeKill(true, "db_error_fail_closed", now.Add(killSwitchErrorTTL))
		return true, "db_error_fail_closed", nil
	}
	blocked := killSwitchEnabled(raw)
	a.storeKill(blocked, "db", now.Add(killSwitchFreshTTL))
	return blocked, "db", nil
}

func (a Assistant) storeKill(blocked bool, source string, expires time.Time) {
	if a.kill == nil {
		return
	}
	a.kill.mu.Lock()
	a.kill.valid = true
	a.kill.blocked = blocked
	a.kill.source = source
	a.kill.expires = expires
	a.kill.mu.Unlock()
}

func killSwitchEnabled(raw json.RawMessage) bool {
	row := firstKillRow(raw)
	return row.Enabled
}

type killSwitchRow struct {
	Enabled bool `json:"enabled"`
}

func firstKillRow(raw json.RawMessage) killSwitchRow {
	raw = bytesTrim(raw)
	if len(raw) == 0 {
		return killSwitchRow{}
	}
	if raw[0] == '[' {
		var rows []killSwitchRow
		if err := json.Unmarshal(raw, &rows); err != nil || len(rows) == 0 {
			return killSwitchRow{}
		}
		return rows[0]
	}
	var row killSwitchRow
	if err := json.Unmarshal(raw, &row); err != nil {
		return killSwitchRow{}
	}
	return row
}
